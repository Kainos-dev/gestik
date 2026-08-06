// src/features/pagos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { PagoSchema, PagoInput } from './schema';

export async function crearPago(data: PagoInput) {
    const parsed = PagoSchema.parse(data);

    await pool.query(
        `INSERT INTO pagos (cliente_id, servicio_id, fecha, monto, metodo_pago, comprobante_url, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            parsed.clienteId,
            parsed.servicioId ?? null,
            parsed.fecha,
            parsed.monto,
            parsed.metodoPago,
            parsed.comprobanteUrl ?? null,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath(`/clientes/${parsed.clienteId}`);
}

export async function editarPago(id: string, data: PagoInput) {
    const parsed = PagoSchema.parse(data);

    await pool.query(
        `UPDATE pagos
     SET servicio_id = $1, fecha = $2, monto = $3, metodo_pago = $4,
         comprobante_url = $5, notas = $6, updated_at = now()
     WHERE id = $7`,
        [
            parsed.servicioId ?? null,
            parsed.fecha,
            parsed.monto,
            parsed.metodoPago,
            parsed.comprobanteUrl ?? null,
            parsed.notas ?? null,
            id,
        ]
    );

    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath(`/clientes/${parsed.clienteId}`);
}