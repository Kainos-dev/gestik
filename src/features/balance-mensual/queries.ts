// src/features/balance-mensual/queries.ts
import { pool } from '@/lib/db';
import { getCargosFacturadoMes } from '@/features/dashboard/queries';
import { sqlCotizacionBlueVenta } from '@/lib/cotizacion-dolar';
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
// por cargo con el blue venta del día en que se pagó, o el de hoy si
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

// Movimientos de "Plata disponible en cuenta" y de "Caja de ahorro".
//
// Las dos arrancan en su último SALDO_INICIAL de movimientos_cuenta (todo lo
// anterior a su fecha se ignora) y desde ahí suman los ingresos manuales y
// restan los retiros manuales y los gastos pagados con esa cuenta
// (gastos.origen_fondos). Además, sólo en la cuenta: entra cada pago de un
// cliente (lo que realmente llegó: monto_pagado/moneda_pago) y sale cada
// reposición de deuda. Los repartos mensuales ya no mueven ninguna de las
// dos: su 30% de gastos y 40% de ahorro son sólo estimados (ver
// BalanceMensualPanel). Sin saldo inicial, la cuenta no se muestra.
//
// Las dos son en pesos: lo que entra o sale en USD se pasa a pesos con el
// blue venta de su día (ver sqlCotizacionBlueVenta). Cada movimiento trae
// su moneda/monto original y el tipo de cambio usado, para mostrarlo en el
// historial; "monto" es siempre en pesos (NULL si no hay cotización guardada
// para ese día). "orden" decide quién va primero en el mismo día: saldo
// inicial, después lo que entra, después lo que sale.
//
// El total de cada tarjeta y su historial salen de la MISMA lista de
// movimientos (las funciones de abajo), así no pueden desincronizarse.
function sqlMovimientos(cuenta: 'CUENTA' | 'CAJA_AHORRO'): string {
    const pagosYReposiciones =
        cuenta === 'CUENTA'
            ? `
       UNION ALL
       -- Lo que realmente llegó (monto_pagado/moneda_pago), no lo acreditado
       -- al servicio: si un servicio en USD se pagó en pesos, entran pesos.
       SELECT pa.id, 'PAGO', pa.fecha::date,
              COALESCE('Pago de ' || c.nombre, 'Pago'),
              COALESCE(pa.moneda_pago, pa.moneda)::text, COALESCE(pa.monto_pagado, pa.monto),
              CASE WHEN COALESCE(pa.moneda_pago, pa.moneda) = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueVenta('pa.fecha')} END,
              1, pa.created_at
       FROM pagos pa
       JOIN inicio i ON pa.fecha::date >= i.desde
       LEFT JOIN clientes c ON c.id = pa.cliente_id
       UNION ALL
       SELECT rd.id, 'REPOSICION_DEUDA', rd.fecha::date, d.descripcion || ' (' || it.nombre || ')',
              rd.moneda_pago::text, -rd.monto_pagado,
              CASE WHEN rd.moneda_pago = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueVenta('rd.fecha')} END,
              2, rd.created_at
       FROM reposiciones_deuda rd
       JOIN inicio i ON rd.fecha::date >= i.desde
       JOIN deudas d ON d.id = rd.deuda_id
       JOIN integrantes it ON it.id = d.integrante_id
       -- Antes de la migración la clave aún no existe y se lee como NULL.
       WHERE (to_jsonb(rd)->>'anulada_at') IS NULL`
            : '';

    return `
     saldo_inicial AS (
       SELECT * FROM movimientos_cuenta
       WHERE tipo = 'SALDO_INICIAL' AND cuenta = '${cuenta}'
       ORDER BY fecha DESC, created_at DESC
       LIMIT 1
     ),
     inicio AS (
       SELECT (SELECT fecha FROM saldo_inicial) AS desde
     ),
     movimientos_originales AS (
       SELECT si.id, 'SALDO_INICIAL' AS tipo, si.fecha AS fecha,
              COALESCE(si.descripcion, 'Saldo inicial') AS nombre,
              'ARS' AS moneda_original, si.monto AS monto_original, 1::numeric AS tipo_cambio,
              0 AS orden, si.created_at
       FROM saldo_inicial si
       UNION ALL
       SELECT mc.id, mc.tipo::text, mc.fecha,
              COALESCE(mc.descripcion, CASE WHEN mc.tipo = 'INGRESO' THEN 'Ingreso manual' ELSE 'Retiro manual' END),
              'ARS',
              CASE WHEN mc.tipo = 'INGRESO' THEN mc.monto ELSE -mc.monto END,
              1, CASE WHEN mc.tipo = 'INGRESO' THEN 1 ELSE 2 END, mc.created_at
       FROM movimientos_cuenta mc
       JOIN inicio i ON mc.fecha >= i.desde
       WHERE mc.tipo IN ('INGRESO', 'RETIRO') AND mc.cuenta = '${cuenta}'
       UNION ALL
       SELECT g.id,
              CASE WHEN g.gasto_fijo_id IS NOT NULL THEN 'GASTO_FIJO' ELSE 'GASTO' END,
              g.fecha::date, COALESCE(gf.nombre, g.descripcion),
              g.moneda::text, -g.monto,
              CASE WHEN g.moneda = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueVenta('g.fecha')} END,
              2, g.created_at
       FROM gastos g
       JOIN inicio i ON g.fecha::date >= i.desde
       LEFT JOIN gastos_fijos gf ON gf.id = g.gasto_fijo_id
       WHERE g.origen_fondos = '${cuenta}'${pagosYReposiciones}
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
       (SELECT desde FROM inicio) AS desde,
       COALESCE((SELECT SUM(monto) FROM movimientos), 0) AS total,
       EXISTS (SELECT 1 FROM movimientos WHERE monto IS NULL) AS falta_cotizacion`
    );
    const row = rows[0];
    if (!row || row.desde === null) return null; // todavía no tiene saldo inicial
    return { total: Number(row.total), faltaCotizacion: row.falta_cotizacion };
}

// "Plata disponible en cuenta": saldo inicial + pagos de clientes + ingresos
// manuales − gastos pagados con la cuenta − reposiciones de deuda − retiros
// manuales (ver sqlMovimientos).
export function getDisponibleEnCuenta(): Promise<SaldoEnPesos | null> {
    return getSaldo('CUENTA');
}

// "Caja de ahorro": saldo inicial + ingresos manuales − retiros manuales −
// gastos pagados con la caja (ver sqlMovimientos). Un gasto en USD no puede
// salir de la caja (ver validarOrigenFondos en gastos/actions.ts).
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
