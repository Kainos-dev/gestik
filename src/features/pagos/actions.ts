// src/features/pagos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { PagoSchema, PagoInput } from './schema';
import { calcularEquivalenteUsd, calcularMontoAcreditado, evaluarRestauracion, usaCotizacionAutomatica } from './services';
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


// Editar: importe, fecha, moneda, método, cliente y servicio. El servicio
// tiene que ser del cliente elegido (lo verifica resolverConversion), y un
// servicio en USD cobrado en ARS conserva su cotización histórica salvo que
// cambie la fecha, el servicio o la moneda. Cada edición deja la fila
// completa de antes y de después en historial_ediciones.
//
// El estado de los cargos, el saldo del servicio, la caja, Balance Mensual y
// Gestión se recalculan solos: todos leen pagos en vivo, nada queda copiado.
export async function editarPago(id: string, data: PagoInput): Promise<ResultadoPago> {
    const resultado = PagoSchema.safeParse(data);
    if (!resultado.success) return { ok: false, error: resultado.error.issues[0]?.message ?? 'Datos inválidos' };
    const parsed = resultado.data;

    let anterior: (PagoAnterior & { cliente_id: string; version: string }) | undefined;
    let conversion: Conversion;
    try {
        const { rows } = await pool.query(
            // updated_at como TEXTO: un Date de JavaScript sólo tiene milisegundos y
            // Postgres guarda microsegundos, así que comparar con el Date nunca coincidiría.
            `SELECT cliente_id, servicio_id, fecha, moneda, moneda_pago, tipo_cambio, updated_at::text AS version FROM pagos WHERE id = $1`,
            [id]
        );
        anterior = rows[0];
        if (!anterior) return { ok: false, error: 'El cobro no existe o fue anulado' };
        conversion = await resolverConversion(parsed, anterior);
    } catch (error) {
        console.error('Error al resolver la conversión del pago:', error);
        return { ok: false, error: 'No se pudo calcular el cobro. Probá de nuevo.' };
    }
    if (!conversion.ok) return conversion;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Guarda la fila "antes" sólo si nadie la cambió (ni la anuló) desde
        // que se leyó arriba: si no, se aborta en vez de pisar otro cambio.
        const historial = await client.query(
            `INSERT INTO historial_ediciones (tabla, registro_id, datos_anteriores, datos_nuevos)
       SELECT 'pagos', p.id, to_jsonb(p), '{}'::jsonb
       FROM pagos p
       WHERE p.id = $1 AND p.updated_at = $2::timestamptz
       RETURNING id`,
            [id, anterior.version]
        );
        if (!historial.rowCount) {
            await client.query('ROLLBACK');
            return { ok: false, error: 'El cobro cambió o se anuló mientras lo editabas. Volvé a abrirlo.' };
        }

        await client.query(
            `UPDATE pagos
       SET cliente_id = $1, servicio_id = $2, fecha = $3, monto = $4, moneda = $5, moneda_pago = $6, monto_pagado = $7,
           tipo_cambio = $8, metodo_pago = $9, comprobante_url = $10, notas = $11, updated_at = now()
       WHERE id = $12`,
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
                id,
            ]
        );
        await client.query(
            `UPDATE historial_ediciones SET datos_nuevos = (SELECT to_jsonb(p) FROM pagos p WHERE p.id = $1) WHERE id = $2`,
            [id, historial.rows[0].id]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error al editar el pago:', error);
        return { ok: false, error: 'Ocurrió un error al guardar el cobro' };
    } finally {
        client.release();
    }

    revalidarPagos(parsed.clienteId);
    if (anterior.cliente_id !== parsed.clienteId) revalidarPagos(anterior.cliente_id);
    return { ok: true, montoAcreditado: conversion.monto, moneda: conversion.moneda, tipoCambio: conversion.tipoCambio };
}

// ─── Anulación y restauración ───────────────────────────────────────────────
//
// Anular saca el cobro de "pagos" y guarda la fila completa (to_jsonb, sin
// pasar por JavaScript: los numeric conservan toda su precisión) en
// registros_anulados, en una sola transacción. Como todo lo demás — cargos,
// saldo del servicio, caja, Balance Mensual, Gestión — se calcula en vivo
// desde "pagos", el cobro deja de contar en todos lados a la vez, sin que
// ninguna consulta necesite un filtro nuevo. Restaurar lo vuelve a insertar
// idéntico (mismo id, fecha, montos y cotización histórica).
//
// No se puede contar dos veces: la fila está o en pagos o archivada (nunca
// en los dos lados), el índice único registros_anulados_vigente_unico impide
// archivarla dos veces, y las filas se bloquean (FOR UPDATE) mientras dura
// cada operación.

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const MotivoSchema = z
    .string({ error: 'Escribí el motivo de la anulación' })
    .trim()
    .min(3, 'Escribí el motivo de la anulación')
    .max(500, 'El motivo es demasiado largo');

export async function anularPago(id: string, motivo: string): Promise<ResultadoAccion> {
    const motivoValido = MotivoSchema.safeParse(motivo);
    if (!motivoValido.success) return { ok: false, error: motivoValido.error.issues[0]?.message ?? 'Motivo inválido' };

    const client = await pool.connect();
    let clienteId: string;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT cliente_id FROM pagos WHERE id = $1 FOR UPDATE`, [id]);
        if (!rows[0]) {
            await client.query('ROLLBACK');
            return { ok: false, error: 'Ese cobro ya fue anulado o no existe' };
        }
        clienteId = rows[0].cliente_id;

        await client.query(
            `INSERT INTO registros_anulados (tabla, registro_id, datos, motivo)
       SELECT 'pagos', p.id, to_jsonb(p), $2 FROM pagos p WHERE p.id = $1`,
            [id, motivoValido.data]
        );
        const borrado = await client.query(`DELETE FROM pagos WHERE id = $1`, [id]);
        if (borrado.rowCount !== 1) throw new Error('No se pudo sacar el cobro de pagos');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        // 23505: el índice único dice que ya estaba archivado (doble anulación simultánea).
        if ((error as { code?: string }).code === '23505') return { ok: false, error: 'Ese cobro ya fue anulado' };
        console.error('Error al anular el cobro:', error);
        return { ok: false, error: 'Ocurrió un error al anular el cobro' };
    } finally {
        client.release();
    }

    revalidarPagos(clienteId);
    return { ok: true };
}

export async function restaurarPago(registroAnuladoId: string): Promise<ResultadoAccion> {
    const client = await pool.connect();
    let clienteId: string;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT registro_id, restaurado_at,
              datos->>'cliente_id' AS cliente_id, datos->>'servicio_id' AS servicio_id,
              datos->>'moneda' AS moneda, datos->>'moneda_pago' AS moneda_pago,
              datos->>'monto_pagado' AS monto_pagado, datos->>'fecha' AS fecha
       FROM registros_anulados
       WHERE id = $1 AND tabla = 'pagos'
       FOR UPDATE`,
            [registroAnuladoId]
        );
        const archivado = rows[0];
        if (!archivado) {
            await client.query('ROLLBACK');
            return { ok: false, error: 'No se encontró el cobro anulado' };
        }
        clienteId = archivado.cliente_id;

        const ctx = await client.query(
            `SELECT
         EXISTS (SELECT 1 FROM pagos WHERE id = $1) AS cobro_ya_activo,
         EXISTS (SELECT 1 FROM clientes WHERE id = $2) AS cliente_existe,
         (SELECT moneda FROM servicios WHERE id = $3::text) AS servicio_moneda,
         (SELECT cliente_id FROM servicios WHERE id = $3::text) AS servicio_cliente_id,
         EXISTS (
           SELECT 1 FROM pagos
           WHERE cliente_id = $2 AND servicio_id IS NOT DISTINCT FROM $3::text
             AND fecha = $4::timestamptz AND moneda_pago = $5 AND monto_pagado = $6::numeric
         ) AS hay_cobro_igual_activo`,
            [archivado.registro_id, archivado.cliente_id, archivado.servicio_id, archivado.fecha, archivado.moneda_pago, archivado.monto_pagado]
        );
        const c = ctx.rows[0];
        const evaluacion = evaluarRestauracion(
            { clienteId: archivado.cliente_id, servicioId: archivado.servicio_id, moneda: archivado.moneda },
            {
                yaRestaurado: archivado.restaurado_at !== null,
                cobroYaActivo: c.cobro_ya_activo,
                clienteExiste: c.cliente_existe,
                servicio: c.servicio_moneda ? { clienteId: c.servicio_cliente_id, moneda: c.servicio_moneda } : null,
                hayCobroIgualActivo: c.hay_cobro_igual_activo,
            }
        );
        if (!evaluacion.ok) {
            await client.query('ROLLBACK');
            return evaluacion;
        }

        // Vuelve idéntico (jsonb → fila de pagos, sin pasar por JavaScript); sólo updated_at marca la restauración.
        await client.query(
            `INSERT INTO pagos
       SELECT * FROM jsonb_populate_record(
         NULL::pagos,
         (SELECT datos || jsonb_build_object('updated_at', now()) FROM registros_anulados WHERE id = $1)
       )`,
            [registroAnuladoId]
        );
        await client.query(`UPDATE registros_anulados SET restaurado_at = now() WHERE id = $1`, [registroAnuladoId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if ((error as { code?: string }).code === '23505') return { ok: false, error: 'Ese cobro ya está restaurado' };
        console.error('Error al restaurar el cobro:', error);
        return { ok: false, error: 'Ocurrió un error al restaurar el cobro' };
    } finally {
        client.release();
    }

    revalidarPagos(clienteId);
    return { ok: true };
}
