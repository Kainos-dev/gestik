// src/features/dashboard/queries.ts
import { pool } from '@/lib/db';
import { Pago, mapPago } from '@/features/pagos/types';
import { getSaldoPorCliente } from '@/features/cargos/queries';
import { MONEDAS, Moneda } from '@/lib/moneda';

export interface KpiPorMoneda {
    moneda: Moneda;
    totalFacturadoMes: number;
    totalCobradoMes: number;
    totalPendiente: number;
}

export interface DashboardKpis {
    porMoneda: KpiPorMoneda[];
    clientesActivos: number;
}

// Facturado/cobrado/pendiente no se pueden sumar entre ARS y USD, así que
// cada KPI queda desglosado por moneda en vez de un único número.
export async function getKpis(): Promise<DashboardKpis> {
    const [facturado, cobrado, clientes, saldos] = await Promise.all([
        pool.query(
            `SELECT moneda, COALESCE(SUM(monto), 0) AS total
       FROM cargos
       WHERE date_trunc('month', periodo) = date_trunc('month', CURRENT_DATE)
       GROUP BY moneda`
        ),
        pool.query(
            `SELECT moneda, COALESCE(SUM(monto), 0) AS total
       FROM pagos
       WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
       GROUP BY moneda`
        ),
        pool.query(`SELECT COUNT(*) AS total FROM clientes WHERE estado = 'ACTIVO'`),
        getSaldoPorCliente(),
    ]);

    const facturadoPorMoneda = new Map(facturado.rows.map((r) => [r.moneda, Number(r.total)]));
    const cobradoPorMoneda = new Map(cobrado.rows.map((r) => [r.moneda, Number(r.total)]));
    const pendientePorMoneda = new Map<Moneda, number>();
    for (const s of saldos) {
        pendientePorMoneda.set(s.moneda, (pendientePorMoneda.get(s.moneda) ?? 0) + s.saldo);
    }

    return {
        porMoneda: MONEDAS.map((moneda) => ({
            moneda,
            totalFacturadoMes: facturadoPorMoneda.get(moneda) ?? 0,
            totalCobradoMes: cobradoPorMoneda.get(moneda) ?? 0,
            totalPendiente: pendientePorMoneda.get(moneda) ?? 0,
        })),
        clientesActivos: Number(clientes.rows[0].total),
    };
}

export interface ProximoVencimiento {
    id: string;
    clienteNombre: string;
    clienteColor: string;
    tipo: string;
    nombrePersonalizado: string | null;
    proximoVencimiento: Date;
    precio: number;
    moneda: Moneda;
}

export async function getProximosVencimientos(): Promise<ProximoVencimiento[]> {
    const { rows } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo, s.nombre_personalizado, s.proximo_vencimiento, s.precio, s.moneda
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
        clienteColor: r.cliente_color,
        tipo: r.tipo,
        nombrePersonalizado: r.nombre_personalizado,
        proximoVencimiento: r.proximo_vencimiento,
        precio: Number(r.precio),
        moneda: r.moneda,
    }));
}

export async function getUltimosMovimientos(): Promise<Pago[]> {
    const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo AS servicio_nombre
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN servicios s ON s.id = p.servicio_id
     ORDER BY p.created_at DESC
     LIMIT 10`
    );
    return rows.map(mapPago);
}