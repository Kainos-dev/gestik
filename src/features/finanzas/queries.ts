// src/features/finanzas/queries.ts
import { pool } from '@/lib/db';

export interface IngresoMes {
    mes: string; // "2026-03"
    total: number;
}

export async function getIngresosPorMes(): Promise<IngresoMes[]> {
    const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes, SUM(monto) AS total
     FROM pagos
     WHERE estado = 'PAGADO'
       AND fecha >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY 1
     ORDER BY 1`
    );

    // Completamos los meses sin pagos con $0, para no "esconder" meses flojos
    const mapa = new Map(rows.map((r) => [r.mes, Number(r.total)]));
    const resultado: IngresoMes[] = [];
    const hoy = new Date();

    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        resultado.push({ mes: key, total: mapa.get(key) ?? 0 });
    }

    return resultado;
}

export interface IngresoCliente {
    clienteId: string;
    clienteNombre: string;
    total: number;
}

export async function getIngresosPorCliente(): Promise<IngresoCliente[]> {
    const { rows } = await pool.query(
        `SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, SUM(p.monto) AS total
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE p.estado = 'PAGADO'
     GROUP BY c.id, c.nombre
     ORDER BY total DESC
     LIMIT 10`
    );
    return rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        total: Number(r.total),
    }));
}

export interface ClienteConDeuda {
    clienteId: string;
    clienteNombre: string;
    deuda: number;
    cantidadPagos: number;
}

export async function getClientesConDeuda(): Promise<ClienteConDeuda[]> {
    const { rows } = await pool.query(
        `SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, SUM(p.monto) AS deuda, COUNT(*) AS cantidad
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE p.estado = 'PENDIENTE'
     GROUP BY c.id, c.nombre
     ORDER BY deuda DESC`
    );
    return rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        deuda: Number(r.deuda),
        cantidadPagos: Number(r.cantidad),
    }));
}