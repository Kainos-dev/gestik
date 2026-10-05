// src/features/pagos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { PagoSchema, PagoInput } from './schema';
import { calcularMontoAcreditado } from './services';
import { Moneda } from '@/lib/moneda';

// Resuelve qué se acredita al cargo (monto + moneda) a partir de lo que el
// cliente efectivamente pagó. Si hay servicio asociado, el crédito siempre
// va en SU moneda (no se puede pagar un servicio en una moneda distinta a
// la que está facturado) — convertido con tipoCambio si pagó en otra. Si es
// un pago suelto (sin servicio_id) no hay nada contra qué convertir: se
// acredita tal cual en la moneda que pagó.
async function resolverConversion(
    servicioId: string | undefined,
    montoPagado: number,
    monedaPago: Moneda,
    tipoCambio: number | undefined
): Promise<{ monto: number; moneda: Moneda }> {
    if (!servicioId) return { monto: montoPagado, moneda: monedaPago };

    const { rows } = await pool.query(`SELECT moneda FROM servicios WHERE id = $1`, [servicioId]);
    const monedaServicio: Moneda = rows[0]?.moneda ?? monedaPago;

    if (monedaPago !== monedaServicio && !tipoCambio) {
        throw new Error('Falta el tipo de cambio para convertir el pago');
    }

    const monto = calcularMontoAcreditado(montoPagado, monedaPago, monedaServicio, tipoCambio);
    return { monto, moneda: monedaServicio };
}

export async function crearPago(data: PagoInput) {
    const parsed = PagoSchema.parse(data);
    const { monto, moneda } = await resolverConversion(
        parsed.servicioId,
        parsed.montoPagado,
        parsed.monedaPago,
        parsed.tipoCambio
    );

    await pool.query(
        `INSERT INTO pagos (cliente_id, servicio_id, fecha, monto, moneda, moneda_pago, monto_pagado, tipo_cambio, metodo_pago, comprobante_url, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
            parsed.clienteId,
            parsed.servicioId ?? null,
            parsed.fecha,
            monto,
            moneda,
            parsed.monedaPago,
            parsed.montoPagado,
            moneda !== parsed.monedaPago ? parsed.tipoCambio : null,
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
    const { monto, moneda } = await resolverConversion(
        parsed.servicioId,
        parsed.montoPagado,
        parsed.monedaPago,
        parsed.tipoCambio
    );

    await pool.query(
        `UPDATE pagos
     SET servicio_id = $1, fecha = $2, monto = $3, moneda = $4, moneda_pago = $5, monto_pagado = $6,
         tipo_cambio = $7, metodo_pago = $8, comprobante_url = $9, notas = $10, updated_at = now()
     WHERE id = $11`,
        [
            parsed.servicioId ?? null,
            parsed.fecha,
            monto,
            moneda,
            parsed.monedaPago,
            parsed.montoPagado,
            moneda !== parsed.monedaPago ? parsed.tipoCambio : null,
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
