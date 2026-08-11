// src/features/pagos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { PagoSchema, PagoInput } from './schema';

// El pago siempre hereda la moneda del servicio cuando está asociado a uno
// (no se puede pagar un servicio en USD con pesos ni viceversa) — se ignora
// lo que haya mandado el form en ese caso, para que un bug de UI no pueda
// dejar un pago en una moneda distinta a la del servicio que dice cubrir.
async function resolverMoneda(servicioId: string | undefined, monedaForm: 'ARS' | 'USD') {
    if (!servicioId) return monedaForm;
    const { rows } = await pool.query(`SELECT moneda FROM servicios WHERE id = $1`, [servicioId]);
    return rows[0]?.moneda ?? monedaForm;
}

export async function crearPago(data: PagoInput) {
    const parsed = PagoSchema.parse(data);
    const moneda = await resolverMoneda(parsed.servicioId, parsed.moneda);

    await pool.query(
        `INSERT INTO pagos (cliente_id, servicio_id, fecha, monto, moneda, metodo_pago, comprobante_url, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            parsed.clienteId,
            parsed.servicioId ?? null,
            parsed.fecha,
            parsed.monto,
            moneda,
            parsed.metodoPago,
            parsed.comprobanteUrl ?? null,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath('/dashboard');
    revalidatePath(`/clientes/${parsed.clienteId}`);
}

export async function editarPago(id: string, data: PagoInput) {
    const parsed = PagoSchema.parse(data);
    const moneda = await resolverMoneda(parsed.servicioId, parsed.moneda);

    await pool.query(
        `UPDATE pagos
     SET servicio_id = $1, fecha = $2, monto = $3, moneda = $4, metodo_pago = $5,
         comprobante_url = $6, notas = $7, updated_at = now()
     WHERE id = $8`,
        [
            parsed.servicioId ?? null,
            parsed.fecha,
            parsed.monto,
            moneda,
            parsed.metodoPago,
            parsed.comprobanteUrl ?? null,
            parsed.notas ?? null,
            id,
        ]
    );

    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath('/dashboard');
    revalidatePath(`/clientes/${parsed.clienteId}`);
}

// Borrar un pago no requiere tocar cargos aparte: el estado y "cubierto" de
// cada cargo se recalculan en vivo en cada request (waterfall sobre los
// pagos existentes, ver getCargos en cargos/queries.ts), así que sacar la
// fila alcanza para que todo — cargos, saldos, KPIs — vuelva a como estaba.
export async function eliminarPago(id: string) {
    const { rows } = await pool.query(`DELETE FROM pagos WHERE id = $1 RETURNING cliente_id`, [id]);
    const clienteId = rows[0]?.cliente_id;

    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath('/dashboard');
    if (clienteId) revalidatePath(`/clientes/${clienteId}`);
}