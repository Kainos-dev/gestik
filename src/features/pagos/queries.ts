// src/features/pagos/queries.ts
import { pool } from '@/lib/db';
import { Pago, PagoAnulado, mapPago, mapPagoAnulado } from './types';

export async function getPagos(): Promise<Pago[]> {
    const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo AS servicio_nombre
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

// Para el selector de servicio dentro del form de pagos (sólo servicios de
// ese cliente). saldo_pendiente es lo que falta cubrir del servicio en SU
// moneda: total de cargos menos total de pagos asociados, sin bajar de 0 —
// el mismo total que reparte el waterfall de getCargos (cargos/queries.ts).
// excluirPagoId saca de la cuenta el pago que se está editando, para que el
// formulario muestre el saldo "antes" de ese pago.
export async function getServiciosParaSelector(clienteId: string, excluirPagoId?: string | null) {
    const { rows } = await pool.query(
        `SELECT s.id, s.tipo, s.nombre_personalizado, s.moneda,
            GREATEST(0,
              COALESCE((SELECT SUM(c.monto) FROM cargos c WHERE c.servicio_id = s.id), 0)
              - COALESCE((SELECT SUM(p.monto) FROM pagos p
                          WHERE p.servicio_id = s.id AND ($2::text IS NULL OR p.id <> $2)), 0)
            )::float8 AS saldo_pendiente
     FROM servicios s
     -- Al editar, también el servicio que ya tenía el pago aunque esté pausado o
     -- finalizado: si no, el selector no podría mostrarlo.
     WHERE s.cliente_id = $1
       AND (s.estado = 'ACTIVO' OR s.id = (SELECT servicio_id FROM pagos WHERE id = $2::text))
     ORDER BY s.tipo`,
        [clienteId, excluirPagoId ?? null]
    );
    return rows;
}

// Cobros anulados que todavía no se restauraron, con la fila original
// reconstruida desde el jsonb (mismas columnas que pagos, ver mapPago).
export async function getPagosAnulados(): Promise<PagoAnulado[]> {
    const { rows } = await pool.query(
        `SELECT p.*, ra.id AS registro_anulado_id, ra.motivo, ra.anulado_at,
            c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo AS servicio_nombre
     FROM registros_anulados ra
     CROSS JOIN LATERAL jsonb_populate_record(NULL::pagos, ra.datos) p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN servicios s ON s.id = p.servicio_id
     WHERE ra.tabla = 'pagos' AND ra.restaurado_at IS NULL
     ORDER BY ra.anulado_at DESC`
    );
    return rows.map(mapPagoAnulado);
}
