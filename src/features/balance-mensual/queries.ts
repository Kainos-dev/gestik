// src/features/balance-mensual/queries.ts
import { pool } from '@/lib/db';
import { getCargosFacturadoMes } from '@/features/dashboard/queries';
import { RepartoMensual, mapRepartoMensual, MesPendienteDeReparto } from './types';

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

// Ahorro de siempre: suma de "ahorro_mes_ars" de todos los repartos ya
// generados — ya viene fundido en pesos (ver domain model).
export async function getAhorroAcumulado(): Promise<number> {
    const { rows } = await pool.query(`SELECT COALESCE(SUM(ahorro_mes_ars), 0) AS total FROM repartos_mensuales`);
    return Number(rows[0].total);
}

// Aproximado de lo disponible en Mercado Pago: lo que se fue apartando mes
// a mes para la cuenta de gastos fijos y deudas (sólo la porción en ARS,
// que es la que efectivamente vive en MP) menos lo que realmente se gastó
// en gastos fijos y en reposiciones de deuda pagadas en pesos, desde que
// arrancó el primer reparto (no cuenta gasto viejo de antes de usar esto,
// porque nunca se apartó plata para esos gastos acá). Puede dar negativo
// si se gastó más de lo que había en la bolsa — es sólo un aproximado, tal
// como pide el domain model.
export async function getDisponibleEnMP(): Promise<number | null> {
    const { rows } = await pool.query(
        `WITH primer_reparto AS (
       SELECT MIN(mes) AS desde FROM repartos_mensuales
     ),
     apartado AS (
       SELECT COALESCE(SUM(gastos_deudas_ars), 0) AS total FROM repartos_mensuales
     ),
     gastos_pagados AS (
       SELECT COALESCE(SUM(g.monto), 0) AS total
       FROM gastos g, primer_reparto p
       WHERE g.moneda = 'ARS' AND g.fecha >= p.desde
     ),
     reposiciones_pagadas AS (
       SELECT COALESCE(SUM(r.monto_pagado), 0) AS total
       FROM reposiciones_deuda r, primer_reparto p
       WHERE r.moneda_pago = 'ARS' AND r.fecha >= p.desde
     )
     SELECT
       (SELECT desde FROM primer_reparto) AS desde,
       (SELECT total FROM apartado) - (SELECT total FROM gastos_pagados) - (SELECT total FROM reposiciones_pagadas) AS disponible`
    );
    const row = rows[0];
    if (!row || row.desde === null) return null; // todavía no hay ningún reparto generado
    return Number(row.disponible);
}
