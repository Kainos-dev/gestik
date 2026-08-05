// src/features/pagos/queries.ts
import { pool } from '@/lib/db';
import { Pago, mapPago } from './types';

export async function getPagos(): Promise<Pago[]> {
    const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS cliente_nombre, s.tipo AS servicio_nombre
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN servicios s ON s.id = p.servicio_id
     ORDER BY p.fecha DESC`
    );
    return rows.map(mapPago);
}

export async function getPagosByCliente(clienteId: string): Promise<Pago[]> {
    const { rows } = await pool.query(
        `SELECT p.*, s.tipo AS servicio_nombre
     FROM pagos p
     LEFT JOIN servicios s ON s.id = p.servicio_id
     WHERE p.cliente_id = $1
     ORDER BY p.fecha DESC`,
        [clienteId]
    );
    return rows.map(mapPago);
}

// Para el selector de servicio dentro del form de pagos (sólo servicios de ese cliente)
export async function getServiciosParaSelector(clienteId: string) {
    const { rows } = await pool.query(
        `SELECT id, tipo, nombre_personalizado FROM servicios WHERE cliente_id = $1 AND estado = 'ACTIVO' ORDER BY tipo`,
        [clienteId]
    );
    return rows;
}