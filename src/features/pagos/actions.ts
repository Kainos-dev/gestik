// src/features/pagos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { PagoSchema, PagoInput } from './schema';
import { calcularEquivalenteUsd, calcularMontoAcreditado, usaCotizacionAutomatica } from './services';
import { Moneda } from '@/lib/moneda';
import { resolverCotizacionBlue } from '@/lib/cotizacion-dolar';
import { dateToSqlDateString } from '@/lib/utils';

// Devuelven un resultado en vez de tirar: en producción Next.js reemplaza
// el mensaje de cualquier error tirado en un server action por uno
// genérico, y acá hay que poder explicar, por ejemplo, que no hay cotización.
export type ResultadoPago =
    | { ok: true; montoAcreditado: number; moneda: Moneda; tipoCambio: number | null }
    | { ok: false; error: string };

type PagoParseado = z.output<typeof PagoSchema>;

// Lo que importa del pago que se está editando para decidir si se conserva
// su cotización original.
interface PagoAnterior {
    servicio_id: string | null;
    fecha: Date;
    moneda: Moneda;
    moneda_pago: Moneda;
    tipo_cambio: string | null;
}

type Conversion = { ok: true; monto: number; moneda: Moneda; tipoCambio: number | null } | { ok: false; error: string };

// Resuelve qué se acredita al cargo (monto + moneda) a partir de lo que el
// cliente efectivamente pagó. Si hay servicio asociado, el crédito siempre
// va en SU moneda (no se puede pagar un servicio en una moneda distinta a
// la que está facturado). Si es un pago suelto (sin servicio_id) no hay
// nada contra qué convertir: se acredita tal cual en la moneda que pagó.
//
// Servicio en USD cobrado en ARS: la cotización la decide el servidor (blue
// venta del día del cobro), nunca el navegador — cualquier tipoCambio que
// llegue en el formulario se ignora. Se guarda con el pago y no se recalcula:
// al editar, si no cambió ni la fecha ni el servicio ni la moneda, se
// conserva la cotización con la que se registró.
async function resolverConversion(parsed: PagoParseado, anterior?: PagoAnterior): Promise<Conversion> {
    if (!parsed.servicioId) return { ok: true, monto: parsed.montoPagado, moneda: parsed.monedaPago, tipoCambio: null };

    const { rows } = await pool.query(`SELECT moneda, cliente_id FROM servicios WHERE id = $1`, [parsed.servicioId]);
    const servicio = rows[0];
    if (!servicio) return { ok: false, error: 'El servicio no existe' };
    if (servicio.cliente_id !== parsed.clienteId) return { ok: false, error: 'El servicio no pertenece a ese cliente' };
    const monedaServicio: Moneda = servicio.moneda;

    if (parsed.monedaPago === monedaServicio) {
        return { ok: true, monto: parsed.montoPagado, moneda: monedaServicio, tipoCambio: null };
    }

    if (usaCotizacionAutomatica(monedaServicio, parsed.monedaPago)) {
        const fechaSql = dateToSqlDateString(parsed.fecha);
        let tipoCambio: number;

        const conservaCotizacion =
            anterior !== undefined &&
            anterior.tipo_cambio !== null &&
            Number(anterior.tipo_cambio) > 0 &&
            anterior.servicio_id === parsed.servicioId &&
            anterior.moneda === monedaServicio &&
            anterior.moneda_pago === parsed.monedaPago &&
            dateToSqlDateString(new Date(anterior.fecha)) === fechaSql;

        if (conservaCotizacion) {
            tipoCambio = Number(anterior!.tipo_cambio);
        } else {
            const cotizacion = await resolverCotizacionBlue(fechaSql);
            if (!cotizacion.ok) return cotizacion;
            tipoCambio = cotizacion.venta;
        }

        const monto = calcularEquivalenteUsd(parsed.montoPagado, tipoCambio);
        if (monto === null || !(monto > 0)) {
            return { ok: false, error: 'El monto es demasiado chico para acreditar al servicio' };
        }
        return { ok: true, monto, moneda: monedaServicio, tipoCambio };
    }

    // Servicio en ARS cobrado en USD: igual que siempre, tipo de cambio manual.
    if (!parsed.tipoCambio) return { ok: false, error: 'Falta el tipo de cambio para convertir el pago' };
    const monto = calcularMontoAcreditado(parsed.montoPagado, parsed.monedaPago, monedaServicio, parsed.tipoCambio);
    return { ok: true, monto, moneda: monedaServicio, tipoCambio: parsed.tipoCambio };
}

function revalidarPagos(clienteId: string) {
    revalidatePath('/pagos');
    revalidatePath('/gestion');
    revalidatePath('/dashboard');
    revalidatePath(`/clientes/${clienteId}`);
}

// Ventana en la que un pago idéntico (mismo cliente, servicio, fecha, monto
// y moneda) se considera un doble envío del mismo formulario.
const VENTANA_DUPLICADO = '2 minutes';

export async function crearPago(data: PagoInput): Promise<ResultadoPago> {
    const resultado = PagoSchema.safeParse(data);
    if (!resultado.success) return { ok: false, error: resultado.error.issues[0]?.message ?? 'Datos inválidos' };
    const parsed = resultado.data;

    let conversion: Conversion;
    try {
        conversion = await resolverConversion(parsed);
    } catch (error) {
        console.error('Error al resolver la conversión del pago:', error);
        return { ok: false, error: 'No se pudo calcular el pago. Probá de nuevo.' };
    }
    if (!conversion.ok) return conversion;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Serializa los pagos de un mismo cliente: dos envíos simultáneos del
        // mismo formulario no pueden pasar los dos el chequeo de duplicado.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`pago:${parsed.clienteId}`]);

        const duplicado = await client.query(
            `SELECT 1 FROM pagos
       WHERE cliente_id = $1 AND servicio_id IS NOT DISTINCT FROM $2 AND fecha = $3
         AND moneda_pago = $4 AND monto_pagado = $5
         AND created_at > now() - $6::interval
       LIMIT 1`,
            [parsed.clienteId, parsed.servicioId ?? null, parsed.fecha, parsed.monedaPago, parsed.montoPagado, VENTANA_DUPLICADO]
        );
        if (duplicado.rowCount) {
            await client.query('ROLLBACK');
            return {
                ok: false,
                error: 'Ese mismo pago ya se registró hace instantes. Revisá el historial antes de cargarlo de nuevo.',
            };
        }

        await client.query(
            `INSERT INTO pagos (cliente_id, servicio_id, fecha, monto, moneda, moneda_pago, monto_pagado, tipo_cambio, metodo_pago, comprobante_url, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                parsed.clienteId,
                parsed.servicioId ?? null,
                parsed.fecha,
                conversion.monto,
                conversion.moneda,
                parsed.monedaPago,
                parsed.montoPagado,
                conversion.tipoCambio,
                parsed.metodoPago,
                parsed.comprobanteUrl ?? null,
                parsed.notas ?? null,
            ]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error al registrar el pago:', error);
        return { ok: false, error: 'Ocurrió un error al guardar el pago' };
    } finally {
        client.release();
    }

    revalidarPagos(parsed.clienteId);
    return { ok: true, montoAcreditado: conversion.monto, moneda: conversion.moneda, tipoCambio: conversion.tipoCambio };
}

export async function editarPago(id: string, data: PagoInput): Promise<ResultadoPago> {
    const resultado = PagoSchema.safeParse(data);
    if (!resultado.success) return { ok: false, error: resultado.error.issues[0]?.message ?? 'Datos inválidos' };
    const parsed = resultado.data;

    try {
        const { rows } = await pool.query(
            `SELECT servicio_id, fecha, moneda, moneda_pago, tipo_cambio FROM pagos WHERE id = $1 AND cliente_id = $2`,
            [id, parsed.clienteId]
        );
        const anterior: PagoAnterior | undefined = rows[0];
        if (!anterior) return { ok: false, error: 'El pago no existe' };

        const conversion = await resolverConversion(parsed, anterior);
        if (!conversion.ok) return conversion;

        await pool.query(
            `UPDATE pagos
       SET servicio_id = $1, fecha = $2, monto = $3, moneda = $4, moneda_pago = $5, monto_pagado = $6,
           tipo_cambio = $7, metodo_pago = $8, comprobante_url = $9, notas = $10, updated_at = now()
       WHERE id = $11`,
            [
                parsed.servicioId ?? null,
                parsed.fecha,
                conversion.monto,
                conversion.moneda,
                parsed.monedaPago,
                parsed.montoPagado,
                conversion.tipoCambio,
                parsed.metodoPago,
                parsed.comprobanteUrl ?? null,
                parsed.notas ?? null,
                id,
            ]
        );

        revalidarPagos(parsed.clienteId);
        return { ok: true, montoAcreditado: conversion.monto, moneda: conversion.moneda, tipoCambio: conversion.tipoCambio };
    } catch (error) {
        console.error('Error al editar el pago:', error);
        return { ok: false, error: 'Ocurrió un error al guardar el pago' };
    }
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
