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

export interface TotalPorMoneda {
    moneda: Moneda;
    total: number;
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
