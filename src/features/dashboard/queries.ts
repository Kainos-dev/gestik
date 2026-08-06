// src/features/dashboard/queries.ts
import { pool } from '@/lib/db';
import { Pago, mapPago } from '@/features/pagos/types';
import { getSaldoPorCliente } from '@/features/cargos/queries';

export interface DashboardKpis {
    totalFacturadoMes: number;
    totalCobradoMes: number;
    totalPendiente: number;
    clientesActivos: number;
}

export async function getKpis(): Promise<DashboardKpis> {
    const [facturado, cobrado, clientes, saldos] = await Promise.all([
        pool.query(
            `SELECT COALESCE(SUM(monto), 0) AS total
       FROM cargos
       WHERE date_trunc('month', periodo) = date_trunc('month', CURRENT_DATE)`
        ),
        pool.query(
            `SELECT COALESCE(SUM(monto), 0) AS total
       FROM pagos
       WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)`
        ),
        pool.query(`SELECT COUNT(*) AS total FROM clientes WHERE estado = 'ACTIVO'`),
        getSaldoPorCliente(),
    ]);

    return {
        totalFacturadoMes: Number(facturado.rows[0].total),
        totalCobradoMes: Number(cobrado.rows[0].total),
        totalPendiente: saldos.reduce((acc, s) => acc + s.saldo, 0),
        clientesActivos: Number(clientes.rows[0].total),
    };
}

export interface ProximoVencimiento {
    id: string;
    clienteNombre: string;
    tipo: string;
    nombrePersonalizado: string | null;
    proximoVencimiento: Date;
    precio: number;
}

export async function getProximosVencimientos(): Promise<ProximoVencimiento[]> {
    const { rows } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, s.tipo, s.nombre_personalizado, s.proximo_vencimiento, s.precio
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     WHERE s.estado = 'ACTIVO'
       AND s.proximo_vencimiento IS NOT NULL
       AND s.proximo_vencimiento <= CURRENT_DATE + INTERVAL '15 days'
     ORDER BY s.proximo_vencimiento ASC
     LIMIT 8`
    );
    return rows.map((r) => ({
        id: r.id,
        clienteNombre: r.cliente_nombre,
        tipo: r.tipo,
        nombrePersonalizado: r.nombre_personalizado,
        proximoVencimiento: r.proximo_vencimiento,
        precio: Number(r.precio),
    }));
}

export async function getUltimosMovimientos(): Promise<Pago[]> {
    const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS cliente_nombre, s.tipo AS servicio_nombre
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN servicios s ON s.id = p.servicio_id
     ORDER BY p.created_at DESC
     LIMIT 10`
    );
    return rows.map(mapPago);
}