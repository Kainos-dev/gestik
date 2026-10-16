// src/features/balance-mensual/queries.ts
import { pool } from '@/lib/db';
import { getCargosFacturadoMes } from '@/features/dashboard/queries';
import {
    RepartoMensual,
    mapRepartoMensual,
    MesPendienteDeReparto,
    MovimientoSaldo,
    mapMovimientoSaldo,
} from './types';

// Suma el Facturado de un mes (ver getCargosFacturadoMes en
// dashboard/queries.ts) agrupado por moneda — es la base sobre la que se
// calcula el reparto de ese mes (ver calcularReparto en services.ts).
export async function getFacturadoDelMes(mes: Date): Promise<{ ars: number; usd: number }> {
    const cargos = await getCargosFacturadoMes(mes);
    let ars = 0;
    let usd = 0;
    for (const c of cargos) {
        if (c.moneda === 'ARS') ars += c.contribucionMes;
        else usd += c.contribucionMes;
    }
    return { ars, usd };
}

// Meses ya cerrados (anteriores al actual) que tuvieron cargos con
// vencimiento ese mes, pero todavía no tienen un reparto generado — ver
// renovar-repartos-mensuales (actions.ts), que recorre esta lista: si un
// mes no tuvo Facturado en USD se genera solo, si tuvo, queda pendiente de
// que alguien cargue el tipo de cambio (ver domain model, PD1). Tope de 24
// meses de catch-up, mismo criterio que MAX_CICLOS_CATCH_UP en
// services/actions.ts y gastos/actions.ts.
const MAX_MESES_CATCH_UP = 24;

export async function getMesesPendientesDeReparto(): Promise<MesPendienteDeReparto[]> {
    const { rows } = await pool.query(
        `SELECT DISTINCT date_trunc('month', vencimiento) AS mes
     FROM cargos
     WHERE date_trunc('month', vencimiento) < date_trunc('month', CURRENT_DATE)
       AND date_trunc('month', vencimiento) NOT IN (SELECT mes FROM repartos_mensuales)
     ORDER BY mes ASC
     LIMIT $1`,
        [MAX_MESES_CATCH_UP]
    );

    const pendientes: MesPendienteDeReparto[] = [];
    for (const row of rows) {
        const { ars, usd } = await getFacturadoDelMes(row.mes);
        pendientes.push({ mes: row.mes, facturadoArs: ars, facturadoUsd: usd });
    }
    return pendientes;
}

export async function getRepartosMensuales(): Promise<RepartoMensual[]> {
    const { rows } = await pool.query(`SELECT * FROM repartos_mensuales ORDER BY mes ASC`);
    return rows.map(mapRepartoMensual);
}

// Tanto la cuenta como la caja de ahorro sólo cuentan movimientos desde el
// primer reparto: antes de eso nunca se apartó plata, así que gastos viejos
// sólo las harían arrancar en negativo. De qué saldo sale cada gasto lo dice
// gastos.origen_fondos (los generados por un gasto fijo, siempre CUENTA; los
// sueltos viejos sin origen no se descuentan de ningún lado).

// "Plata disponible en cuenta" (aproximado): lo único que entra a la cuenta
// es la porción de gastos fijos y deudas (30%) de cada reparto — sueldos y
// ahorro no pasan por ahí. Sale todo gasto pagado con la cuenta (los fijos
// los genera solos el cron renovar-gastos-fijos al vencer) y las
// reposiciones de deuda. Separado por moneda, sin convertir: las
// reposiciones se agrupan por la moneda en la que se pagaron (moneda_pago),
// que es la plata que efectivamente salió. Puede dar negativo si se gastó
// más de lo que se apartó — es sólo un aproximado.
export interface DisponibleEnCuenta {
    ars: number;
    usd: number;
}

export async function getDisponibleEnCuenta(): Promise<DisponibleEnCuenta | null> {
    const { rows } = await pool.query(
        `WITH primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     ),
     apartado AS (
       SELECT COALESCE(SUM(gastos_deudas_ars), 0) AS ars, COALESCE(SUM(gastos_deudas_usd), 0) AS usd
       FROM repartos_mensuales
     ),
     gastos_pagados AS (
       SELECT
         COALESCE(SUM(g.monto) FILTER (WHERE g.moneda = 'ARS'), 0) AS ars,
         COALESCE(SUM(g.monto) FILTER (WHERE g.moneda = 'USD'), 0) AS usd
       FROM gastos g, primer_reparto p
       WHERE g.origen_fondos = 'CUENTA' AND g.fecha >= p.desde
     ),
     reposiciones_pagadas AS (
       SELECT
         COALESCE(SUM(r.monto_pagado) FILTER (WHERE r.moneda_pago = 'ARS'), 0) AS ars,
         COALESCE(SUM(r.monto_pagado) FILTER (WHERE r.moneda_pago = 'USD'), 0) AS usd
       FROM reposiciones_deuda r, primer_reparto p
       WHERE r.fecha >= p.desde
     )
     SELECT
       (SELECT desde FROM primer_reparto) AS desde,
       a.ars - g.ars - r.ars AS ars,
       a.usd - g.usd - r.usd AS usd
     FROM apartado a, gastos_pagados g, reposiciones_pagadas r`
    );
    const row = rows[0];
    if (!row || row.desde === null) return null; // todavía no hay ningún reparto generado
    return { ars: Number(row.ars), usd: Number(row.usd) };
}

// "Caja de ahorro": el 40% de cada reparto (ya fundido en pesos, ver
// domain model) menos los gastos pagados con la caja de ahorro (compras
// grandes). Sólo pesos: un gasto en USD no puede salir de la caja (lo
// valida el server action, ver validarOrigenFondos en gastos/actions.ts).
export async function getCajaDeAhorro(): Promise<number | null> {
    const { rows } = await pool.query(
        `WITH primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     )
     SELECT
       (SELECT desde FROM primer_reparto) AS desde,
       (SELECT COALESCE(SUM(ahorro_mes_ars), 0) FROM repartos_mensuales)
         - (SELECT COALESCE(SUM(g.monto), 0)
            FROM gastos g, primer_reparto p
            WHERE g.origen_fondos = 'CAJA_AHORRO' AND g.fecha >= p.desde) AS total`
    );
    const row = rows[0];
    if (!row || row.desde === null) return null; // todavía no hay ningún reparto generado
    return Number(row.total);
}

// Cuántos renglones muestra el historial de cada saldo (pedido del equipo).
const MAX_MOVIMIENTOS_SALDO = 10;

// Historial de "Plata disponible en cuenta" / "Caja de ahorro": exactamente
// los mismos movimientos que suman/restan getDisponibleEnCuenta /
// getCajaDeAhorro, cada uno con el saldo en que dejó la cuenta (acumulado
// por moneda sobre TODA la historia, no sólo sobre los últimos 10 — así el
// renglón más nuevo coincide con la tarjeta). Cada reparto se fecha el 1º
// del mes siguiente, que es cuando se genera (ver
// renovar-repartos-mensuales); a igual fecha, primero entra la plata y
// después sale. Más nuevo primero.
const SQL_SALDO_ACUMULADO = `
     con_saldo AS (
       SELECT *,
              SUM(monto) OVER (
                PARTITION BY moneda
                ORDER BY fecha, orden, created_at, id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS saldo
       FROM movimientos
     )
     SELECT * FROM con_saldo
     ORDER BY fecha DESC, orden DESC, created_at DESC, id DESC
     LIMIT $1`;

// Gastos pagados con "origen" (CUENTA o CAJA_AHORRO), como movimientos de
// salida — compartido por los dos historiales.
const SQL_GASTOS_COMO_MOVIMIENTOS = `
       SELECT g.id,
              CASE WHEN g.gasto_fijo_id IS NOT NULL THEN 'GASTO_FIJO' ELSE 'GASTO' END,
              g.fecha::date, COALESCE(gf.nombre, g.descripcion), NULL,
              g.moneda::text, -g.monto, 1, g.created_at
       FROM gastos g
       JOIN primer_reparto p ON g.fecha >= p.desde
       LEFT JOIN gastos_fijos gf ON gf.id = g.gasto_fijo_id
       WHERE g.origen_fondos = $2`;

export async function getMovimientosCuenta(): Promise<MovimientoSaldo[]> {
    const { rows } = await pool.query(
        `WITH primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     ),
     movimientos AS (
       SELECT r.id || '-ARS' AS id, 'REPARTO' AS tipo, (r.mes + INTERVAL '1 month')::date AS fecha,
              NULL::text AS nombre, r.mes AS mes_reparto, 'ARS' AS moneda, r.gastos_deudas_ars AS monto,
              0 AS orden, r.created_at
       FROM repartos_mensuales r
       UNION ALL
       SELECT r.id || '-USD', 'REPARTO', (r.mes + INTERVAL '1 month')::date,
              NULL, r.mes, 'USD', r.gastos_deudas_usd, 0, r.created_at
       FROM repartos_mensuales r
       WHERE r.gastos_deudas_usd <> 0
       UNION ALL
       ${SQL_GASTOS_COMO_MOVIMIENTOS}
       UNION ALL
       SELECT rd.id, 'REPOSICION_DEUDA', rd.fecha::date, d.descripcion || ' (' || i.nombre || ')', NULL,
              rd.moneda_pago::text, -rd.monto_pagado, 1, rd.created_at
       FROM reposiciones_deuda rd
       JOIN primer_reparto p ON rd.fecha >= p.desde
       JOIN deudas d ON d.id = rd.deuda_id
       JOIN integrantes i ON i.id = d.integrante_id
     ),
     ${SQL_SALDO_ACUMULADO}`,
        [MAX_MOVIMIENTOS_SALDO, 'CUENTA']
    );
    return rows.map(mapMovimientoSaldo);
}

export async function getMovimientosAhorro(): Promise<MovimientoSaldo[]> {
    const { rows } = await pool.query(
        `WITH primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     ),
     movimientos AS (
       SELECT r.id, 'REPARTO' AS tipo, (r.mes + INTERVAL '1 month')::date AS fecha,
              NULL::text AS nombre, r.mes AS mes_reparto, 'ARS' AS moneda, r.ahorro_mes_ars AS monto,
              0 AS orden, r.created_at
       FROM repartos_mensuales r
       UNION ALL
       ${SQL_GASTOS_COMO_MOVIMIENTOS}
     ),
     ${SQL_SALDO_ACUMULADO}`,
        [MAX_MOVIMIENTOS_SALDO, 'CAJA_AHORRO']
    );
    return rows.map(mapMovimientoSaldo);
}
