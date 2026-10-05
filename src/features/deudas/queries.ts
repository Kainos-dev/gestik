// src/features/deudas/queries.ts
import { pool } from '@/lib/db';
import { Integrante, mapIntegrante, Deuda, mapDeuda, ReposicionDeuda, mapReposicionDeuda } from './types';
import { MONEDAS, Moneda } from '@/lib/moneda';

export async function getIntegrantes(): Promise<Integrante[]> {
    const { rows } = await pool.query(`SELECT * FROM integrantes ORDER BY nombre ASC`);
    return rows.map(mapIntegrante);
}

export async function getIntegrantesActivos(): Promise<Integrante[]> {
    const { rows } = await pool.query(`SELECT * FROM integrantes WHERE activo = true ORDER BY nombre ASC`);
    return rows.map(mapIntegrante);
}

// montoRepuesto se calcula acá (SUM de reposiciones), no se guarda en
// deudas — mismo patrón que montoCubierto en getCargos() (cargos/queries.ts).
export async function getDeudas(): Promise<Deuda[]> {
    const { rows } = await pool.query(
        `SELECT d.*, i.nombre AS integrante_nombre, COALESCE(SUM(r.monto), 0) AS monto_repuesto
     FROM deudas d
     JOIN integrantes i ON i.id = d.integrante_id
     LEFT JOIN reposiciones_deuda r ON r.deuda_id = d.id
     GROUP BY d.id, i.nombre
     ORDER BY d.fecha DESC`
    );
    return rows.map(mapDeuda);
}

export async function getDeudaById(id: string): Promise<Deuda | null> {
    const { rows } = await pool.query(
        `SELECT d.*, i.nombre AS integrante_nombre, COALESCE(SUM(r.monto), 0) AS monto_repuesto
     FROM deudas d
     JOIN integrantes i ON i.id = d.integrante_id
     LEFT JOIN reposiciones_deuda r ON r.deuda_id = d.id
     WHERE d.id = $1
     GROUP BY d.id, i.nombre`,
        [id]
    );
    return rows[0] ? mapDeuda(rows[0]) : null;
}

export async function getReposicionesByDeuda(deudaId: string): Promise<ReposicionDeuda[]> {
    const { rows } = await pool.query(
        `SELECT * FROM reposiciones_deuda WHERE deuda_id = $1 ORDER BY fecha DESC`,
        [deudaId]
    );
    return rows.map(mapReposicionDeuda);
}

// Todas las reposiciones agrupadas por deuda_id, para mostrar el historial
// de cada deuda en la tabla sin hacer una query por fila.
export async function getReposicionesAgrupadas(): Promise<Record<string, ReposicionDeuda[]>> {
    const { rows } = await pool.query(`SELECT * FROM reposiciones_deuda ORDER BY fecha DESC`);
    const agrupadas: Record<string, ReposicionDeuda[]> = {};
    for (const row of rows) {
        const reposicion = mapReposicionDeuda(row);
        (agrupadas[reposicion.deudaId] ??= []).push(reposicion);
    }
    return agrupadas;
}

export interface TotalPorMoneda {
    moneda: Moneda;
    total: number;
}

export interface TotalesDeudas {
    moneda: Moneda;
    totalDeudas: number; // histórico: suma de montoTotal de todas las deudas (ACTIVA + SALDADA)
    totalRepuesto: number; // suma de todas las reposiciones aplicadas, de siempre
    totalPendiente: number; // suma de lo que falta por deuda, sin que una sobrepagada compense a otra
}

// Totales "de toda la vida" para el resumen de la sección Deudas — no hay
// recorte por mes, a diferencia de getTotalReposicionesDeudaMes (esa es
// para el balance de Gestión). Se agrupa por la moneda de la deuda (no por
// moneda_pago de las reposiciones): "montoRepuesto" ya está en la moneda de
// la deuda (ver monto en reposiciones_deuda, domain model), así que suma
// derecho ahí sin mezclar ARS con USD.
export async function getTotalesDeudas(): Promise<TotalesDeudas[]> {
    const { rows } = await pool.query(
        `WITH repuesto AS (
       SELECT deuda_id, COALESCE(SUM(monto), 0) AS monto_repuesto
       FROM reposiciones_deuda
       GROUP BY deuda_id
     )
     SELECT
       d.moneda,
       COALESCE(SUM(d.monto_total), 0) AS total_deudas,
       COALESCE(SUM(COALESCE(r.monto_repuesto, 0)), 0) AS total_repuesto,
       COALESCE(SUM(GREATEST(0, d.monto_total - COALESCE(r.monto_repuesto, 0))), 0) AS total_pendiente
     FROM deudas d
     LEFT JOIN repuesto r ON r.deuda_id = d.id
     GROUP BY d.moneda`
    );
    const porMoneda = new Map(
        rows.map((r) => [
            r.moneda,
            { totalDeudas: Number(r.total_deudas), totalRepuesto: Number(r.total_repuesto), totalPendiente: Number(r.total_pendiente) },
        ])
    );
    return MONEDAS.map((moneda) => ({
        moneda,
        totalDeudas: porMoneda.get(moneda)?.totalDeudas ?? 0,
        totalRepuesto: porMoneda.get(moneda)?.totalRepuesto ?? 0,
        totalPendiente: porMoneda.get(moneda)?.totalPendiente ?? 0,
    }));
}

// Reposiciones del mes agrupadas por moneda_pago (no por la moneda de la
// deuda): lo que golpea el balance en ARS o USD es la plata que realmente
// salió del bolsillo, no la moneda en la que está denominada la deuda.
export async function getTotalReposicionesDeudaMes(): Promise<TotalPorMoneda[]> {
    const { rows } = await pool.query(
        `SELECT moneda_pago AS moneda, COALESCE(SUM(monto_pagado), 0) AS total
     FROM reposiciones_deuda
     WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
     GROUP BY moneda_pago`
    );
    const mapa = new Map(rows.map((r) => [r.moneda, Number(r.total)]));
    return MONEDAS.map((moneda) => ({ moneda, total: mapa.get(moneda) ?? 0 }));
}
