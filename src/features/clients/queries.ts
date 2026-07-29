// src/features/clientes/queries.ts
import { pool } from '@/lib/db';
import { Cliente, mapCliente } from './types';

export async function getClientes(): Promise<Cliente[]> {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nombre ASC');
    return rows.map(mapCliente);
}

export async function getClienteById(id: string): Promise<Cliente | null> {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    return rows[0] ? mapCliente(rows[0]) : null;
}