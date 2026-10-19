// src/features/balance-mensual/queries.ts
import { pool } from '@/lib/db';
import { getCargosFacturadoMes } from '@/features/dashboard/queries';
import { sqlCotizacionBlueCompra } from '@/lib/cotizacion-dolar';
import {
    RepartoMensual,
    mapRepartoMensual,
    MesPendienteDeReparto,
    MovimientoSaldo,
    mapMovimientoSaldo,
} from './types';

// Facturado de un mes (ver getCargosFacturadoMes en dashboard/queries.ts):
// es la base sobre la que se calcula el reparto de ese mes (ver
// calcularReparto en services.ts). La parte en USD se pasa a pesos cargo
// por cargo con el blue compra del día en que se pagó, o el de hoy si
// todavía no se pagó (ver tipoCambio en CargoFacturadoMes). "usdSinCotizacion"
// es lo que no se pudo convertir porque no hay ninguna cotización guardada
// (la API nunca respondió) — mientras sea > 0 el reparto de ese mes no se
// puede generar solo (ver renovarRepartosMensuales).
export interface FacturadoDelMes {
    ars: number;
    usd: number;
    usdEnArs: number;
    usdSinCotizacion: number;
}

export async function getFacturadoDelMes(mes: Date): Promise<FacturadoDelMes> {
    const cargos = await getCargosFacturadoMes(mes);
    const facturado: FacturadoDelMes = { ars: 0, usd: 0, usdEnArs: 0, usdSinCotizacion: 0 };
    for (const c of cargos) {
        if (c.moneda === 'ARS') {
            facturado.ars += c.contribucionMes;
            continue;
        }
        facturado.usd += c.contribucionMes;
        if (c.contribucionMesArs !== null) facturado.usdEnArs += c.contribucionMesArs;
        else facturado.usdSinCotizacion += c.contribucionMes;
    }
    return facturado;
}

// Meses ya cerrados (anteriores al actual) que tuvieron cargos con
// vencimiento ese mes, pero todavía no tienen un reparto generado — ver
// renovar-repartos-mensuales (actions.ts), que recorre esta lista: se
// generan solos, salvo un mes con USD que no se pudo convertir por falta de
// cotización — ése queda pendiente de que alguien cargue el tipo de cambio a
// mano (ver TipoCambioMensualGate). Tope de 24
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
        const { ars, usd, usdSinCotizacion } = await getFacturadoDelMes(row.mes);
        pendientes.push({ mes: row.mes, facturadoArs: ars, facturadoUsd: usd, usdSinCotizacion });
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
//
// Las dos son en pesos: lo que sale en USD (una reposición de deuda pagada
// en dólares, un gasto en USD) se resta pasado a pesos con el blue compra
// del día en que se pagó (ver sqlCotizacionBlueCompra). Cada movimiento
// trae su moneda/monto original y el tipo de cambio usado, para mostrarlo
// en el historial; "monto" es siempre en pesos (NULL si no hay cotización
// guardada para ese día).
//
// El total de cada tarjeta y su historial salen de la MISMA lista de
// movimientos (las funciones de abajo), así no pueden desincronizarse.
function sqlMovimientos(cuenta: 'CUENTA' | 'CAJA_AHORRO'): string {
    const entradas =
        cuenta === 'CUENTA'
            ? // El 30% de gastos de cada reparto. Los repartos viejos podían
              // tener una parte en USD sin convertir (gastos_deudas_usd): se
              // pasa con el tipo de cambio del propio reparto.
              `r.gastos_deudas_ars + r.gastos_deudas_usd * COALESCE(r.tipo_cambio, 0)`
            : `r.ahorro_mes_ars`;

    const reposiciones =
        cuenta === 'CUENTA'
            ? `
       UNION ALL
       SELECT rd.id, 'REPOSICION_DEUDA', rd.fecha::date, d.descripcion || ' (' || i.nombre || ')', NULL::date,
              rd.moneda_pago::text, -rd.monto_pagado,
              CASE WHEN rd.moneda_pago = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueCompra('rd.fecha')} END,
              1, rd.created_at
       FROM reposiciones_deuda rd
       JOIN primer_reparto p ON rd.fecha >= p.desde
       JOIN deudas d ON d.id = rd.deuda_id
       JOIN integrantes i ON i.id = d.integrante_id`
            : '';

    return `
     primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     ),
     movimientos_originales AS (
       -- Cada reparto se fecha el 1º del mes siguiente, que es cuando se
       -- genera (ver renovar-repartos-mensuales).
       SELECT r.id, 'REPARTO' AS tipo, (r.mes + INTERVAL '1 month')::date AS fecha,
              NULL::text AS nombre, r.mes::date AS mes_reparto,
              'ARS' AS moneda_original, ${entradas} AS monto_original, 1::numeric AS tipo_cambio,
              0 AS orden, r.created_at
       FROM repartos_mensuales r
       UNION ALL
       SELECT g.id,
              CASE WHEN g.gasto_fijo_id IS NOT NULL THEN 'GASTO_FIJO' ELSE 'GASTO' END,
              g.fecha::date, COALESCE(gf.nombre, g.descripcion), NULL::date,
              g.moneda::text, -g.monto,
              CASE WHEN g.moneda = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueCompra('g.fecha')} END,
              1, g.created_at
       FROM gastos g
       JOIN primer_reparto p ON g.fecha >= p.desde
       LEFT JOIN gastos_fijos gf ON gf.id = g.gasto_fijo_id
       WHERE g.origen_fondos = '${cuenta}'${reposiciones}
     ),
     movimientos AS (
       SELECT *, monto_original * tipo_cambio AS monto FROM movimientos_originales
     )`;
}

export interface SaldoEnPesos {
    total: number;
    // Hay movimientos en USD que no se pudieron pasar a pesos (no hay
    // ninguna cotización guardada hasta su fecha) y por eso no están en "total".
    faltaCotizacion: boolean;
}

async function getSaldo(cuenta: 'CUENTA' | 'CAJA_AHORRO'): Promise<SaldoEnPesos | null> {
    const { rows } = await pool.query(
        `WITH ${sqlMovimientos(cuenta)}
     SELECT
       (SELECT desde FROM primer_reparto) AS desde,
       COALESCE((SELECT SUM(monto) FROM movimientos), 0) AS total,
       EXISTS (SELECT 1 FROM movimientos WHERE monto IS NULL) AS falta_cotizacion`
    );
    const row = rows[0];
    if (!row || row.desde === null) return null; // todavía no hay ningún reparto generado
    return { total: Number(row.total), faltaCotizacion: row.falta_cotizacion };
}

// "Plata disponible en cuenta" (aproximado): lo único que entra a la cuenta
// es la porción de gastos fijos y deudas (30%) de cada reparto — sueldos y
// ahorro no pasan por ahí. Sale todo gasto pagado con la cuenta (los fijos
// los genera solos el cron renovar-gastos-fijos al vencer) y las
// reposiciones de deuda. Puede dar negativo si se gastó más de lo que se
// apartó — es sólo un aproximado.
export function getDisponibleEnCuenta(): Promise<SaldoEnPesos | null> {
    return getSaldo('CUENTA');
}

// "Caja de ahorro": el 40% de cada reparto menos los gastos pagados con la
// caja de ahorro (compras grandes). Un gasto en USD no puede salir de la
// caja (ver validarOrigenFondos en gastos/actions.ts), pero si alguno viejo
// lo hiciera se convertiría igual que en la cuenta.
export function getCajaDeAhorro(): Promise<SaldoEnPesos | null> {
    return getSaldo('CAJA_AHORRO');
}

// Cuántos renglones muestra el historial de cada saldo (pedido del equipo).
const MAX_MOVIMIENTOS_SALDO = 10;

// Historial de una de las dos tarjetas: los movimientos de getSaldo, cada
// uno con el saldo en pesos en que dejó la cuenta (acumulado sobre TODA la
// historia, no sólo sobre los últimos 10 — así el renglón más nuevo
// coincide con la tarjeta). A igual fecha, primero entra la plata y después
// sale. Más nuevo primero.
async function getMovimientos(cuenta: 'CUENTA' | 'CAJA_AHORRO'): Promise<MovimientoSaldo[]> {
    const { rows } = await pool.query(
        `WITH ${sqlMovimientos(cuenta)},
     con_saldo AS (
       SELECT *,
              SUM(monto) OVER (
                ORDER BY fecha, orden, created_at, id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS saldo
       FROM movimientos
     )
     SELECT * FROM con_saldo
     ORDER BY fecha DESC, orden DESC, created_at DESC, id DESC
     LIMIT $1`,
        [MAX_MOVIMIENTOS_SALDO]
    );
    return rows.map(mapMovimientoSaldo);
}

export function getMovimientosCuenta(): Promise<MovimientoSaldo[]> {
    return getMovimientos('CUENTA');
}

export function getMovimientosAhorro(): Promise<MovimientoSaldo[]> {
    return getMovimientos('CAJA_AHORRO');
}
