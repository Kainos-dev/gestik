// src/features/finanzas/queries.ts
import { pool } from '@/lib/db';
import { getCargos } from '@/features/cargos/queries';
import { calcularEstadoCargo } from '@/features/cargos/services';
import { EstadoCargo } from '@/features/cargos/types';
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

export interface ClienteSaldoCargos {
    clienteId: string;
    clienteNombre: string;
    clienteColor: string;
    moneda: Moneda;
    monto: number;
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

// Agrupa por cliente + moneda el saldo sin cubrir de los cargos que están en
// alguno de "estados" (ver calcularEstadoCargo). Separar por estado acá —y no
// mostrar un único "saldo total" como antes— es lo que permite distinguir
// deuda real (VENCIDO, ya pasó el plazo acordado) de plata que todavía está
// dentro de su ciclo de facturación (PENDIENTE/PARCIAL, no venció todavía).
function agruparPorEstado(cargos: Awaited<ReturnType<typeof getCargos>>, estados: EstadoCargo[]): ClienteSaldoCargos[] {
    const acumulado = new Map<string, ClienteSaldoCargos>();

    for (const c of cargos) {
        if (c.montoCubierto >= c.monto) continue;
        if (!estados.includes(calcularEstadoCargo(c.monto, c.montoCubierto, c.vencimiento))) continue;

        const key = `${c.clienteId}:${c.moneda}`;
        const actual = acumulado.get(key) ?? {
            clienteId: c.clienteId,
            clienteNombre: c.clienteNombre!,
            clienteColor: c.clienteColor!,
            moneda: c.moneda,
            monto: 0,
            cantidadCargos: 0,
        };
        actual.monto += c.monto - c.montoCubierto;
        actual.cantidadCargos += 1;
        acumulado.set(key, actual);
    }

    return Array.from(acumulado.values()).sort((a, b) => b.monto - a.monto);
}

export interface ClientesPorEstadoCargo {
    conDeuda: ClienteSaldoCargos[]; // cargos VENCIDOS: ya pasó el plazo acordado sin cobrarse del todo
    conPagosPendientes: ClienteSaldoCargos[]; // cargos PENDIENTE/PARCIAL: todavía dentro de plazo
}

// Separa clientes con deuda REAL (vencida) de los que sólo tienen pagos
// pendientes dentro de plazo — una sola pasada por getCargos() para no
// consultarlos dos veces. Se muestran como dos listas aparte a propósito:
// que un cliente tenga el cargo del mes sin pagar todavía no significa que
// esté atrasado.
export async function getClientesPorEstadoCargo(): Promise<ClientesPorEstadoCargo> {
    const cargos = await getCargos();
    return {
        conDeuda: agruparPorEstado(cargos, ['VENCIDO']),
        conPagosPendientes: agruparPorEstado(cargos, ['PENDIENTE', 'PARCIAL']),
    };
}