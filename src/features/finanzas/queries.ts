// src/features/finanzas/queries.ts
import { pool } from '@/lib/db';
import { getSaldoPorCliente, getCargos } from '@/features/cargos/queries';
import { MONEDAS, Moneda } from '@/lib/moneda';

export interface IngresoMes {
    mes: string; // "2026-03"
    moneda: Moneda;
    total: number;
}

export async function getIngresosPorMes(): Promise<IngresoMes[]> {
    const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes, moneda, SUM(monto) AS total
     FROM pagos
     WHERE fecha >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY 1, 2
     ORDER BY 1`
    );

    // Completamos los meses sin pagos con $0 (para no "esconder" meses
    // flojos) y cada mes con las dos monedas, aunque una no tenga movimiento.
    const mapa = new Map(rows.map((r) => [`${r.mes}:${r.moneda}`, Number(r.total)]));
    const resultado: IngresoMes[] = [];
    const hoy = new Date();

    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        for (const moneda of MONEDAS) {
            resultado.push({ mes: key, moneda, total: mapa.get(`${key}:${moneda}`) ?? 0 });
        }
    }

    return resultado;
}

export interface IngresoCliente {
    clienteId: string;
    clienteNombre: string;
    clienteColor: string;
    moneda: Moneda;
    total: number;
}

// Top 10 clientes POR MONEDA (no un top 10 global mezclando ARS y USD, que
// no se puede ordenar de forma que tenga sentido) usando una window function
// para rankear dentro de cada moneda en una sola consulta.
export async function getIngresosPorCliente(): Promise<IngresoCliente[]> {
    const { rows } = await pool.query(
        `WITH totales AS (
       SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, c.color AS cliente_color, p.moneda, SUM(p.monto) AS total,
              ROW_NUMBER() OVER (PARTITION BY p.moneda ORDER BY SUM(p.monto) DESC) AS puesto
       FROM pagos p
       JOIN clientes c ON c.id = p.cliente_id
       GROUP BY c.id, c.nombre, c.color, p.moneda
     )
     SELECT cliente_id, cliente_nombre, cliente_color, moneda, total FROM totales WHERE puesto <= 10
     ORDER BY moneda, total DESC`
    );
    return rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        clienteColor: r.cliente_color,
        moneda: r.moneda,
        total: Number(r.total),
    }));
}

export interface ClienteConDeuda {
    clienteId: string;
    clienteNombre: string;
    clienteColor: string;
    moneda: Moneda;
    deuda: number;
    cantidadCargos: number;
}

export interface TotalPorMoneda {
    moneda: Moneda;
    total: number;
}

export async function getTotalIngresosMes(): Promise<TotalPorMoneda[]> {
    const { rows } = await pool.query(
        `SELECT moneda, COALESCE(SUM(monto), 0) AS total
     FROM pagos
     WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
     GROUP BY moneda`
    );
    const mapa = new Map(rows.map((r) => [r.moneda, Number(r.total)]));
    return MONEDAS.map((moneda) => ({ moneda, total: mapa.get(moneda) ?? 0 }));
}

// La cantidad de cargos pendientes se deriva de getCargos() (que ya calcula
// cuánto se cubrió de cada uno) en vez de contar todos los cargos históricos
// del cliente, para que el número que se muestra sea "cuántos períodos le
// faltan pagar" y no "cuántos períodos se le facturaron alguna vez". Se
// cuenta por separado en cada moneda: un cliente puede deber en ARS y en USD
// a la vez, y son dos deudas independientes.
export async function getClientesConDeuda(): Promise<ClienteConDeuda[]> {
    const [saldos, cargos] = await Promise.all([getSaldoPorCliente(), getCargos()]);

    const pendientesPorCliente = new Map<string, number>();
    for (const c of cargos) {
        if (c.montoCubierto < c.monto) {
            const key = `${c.clienteId}:${c.moneda}`;
            pendientesPorCliente.set(key, (pendientesPorCliente.get(key) ?? 0) + 1);
        }
    }

    return saldos
        .filter((s) => s.saldo > 0)
        .map((s) => ({
            clienteId: s.clienteId,
            clienteNombre: s.clienteNombre,
            clienteColor: s.clienteColor,
            moneda: s.moneda,
            deuda: s.saldo,
            cantidadCargos: pendientesPorCliente.get(`${s.clienteId}:${s.moneda}`) ?? 0,
        }))
        .sort((a, b) => b.deuda - a.deuda);
}