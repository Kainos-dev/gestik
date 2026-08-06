// src/features/gastos/queries.ts
import { pool } from '@/lib/db';
import { GastoFijo, mapGastoFijo, Gasto, mapGasto } from './types';

export async function getGastosFijos(): Promise<GastoFijo[]> {
    const { rows } = await pool.query(
        `SELECT * FROM gastos_fijos ORDER BY proximo_vencimiento ASC NULLS LAST`
    );
    return rows.map(mapGastoFijo);
}

export async function getGastoFijoById(id: string): Promise<GastoFijo | null> {
    const { rows } = await pool.query(`SELECT * FROM gastos_fijos WHERE id = $1`, [id]);
    return rows[0] ? mapGastoFijo(rows[0]) : null;
}

export async function getGastos(): Promise<Gasto[]> {
    const { rows } = await pool.query(
        `SELECT g.*, gf.nombre AS gasto_fijo_nombre
     FROM gastos g
     LEFT JOIN gastos_fijos gf ON gf.id = g.gasto_fijo_id
     ORDER BY g.fecha DESC`
    );
    return rows.map(mapGasto);
}

export interface GastoMes {
    mes: string; // "2026-03"
    total: number;
}

export async function getGastosPorMes(): Promise<GastoMes[]> {
    const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes, SUM(monto) AS total
     FROM gastos
     WHERE fecha >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY 1
     ORDER BY 1`
    );

    // Completamos los meses sin gastos con $0, para no "esconder" meses sin carga
    const mapa = new Map(rows.map((r) => [r.mes, Number(r.total)]));
    const resultado: GastoMes[] = [];
    const hoy = new Date();

    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        resultado.push({ mes: key, total: mapa.get(key) ?? 0 });
    }

    return resultado;
}

export async function getTotalGastosMes(): Promise<number> {
    const { rows } = await pool.query(
        `SELECT COALESCE(SUM(monto), 0) AS total
     FROM gastos
     WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)`
    );
    return Number(rows[0].total);
}
