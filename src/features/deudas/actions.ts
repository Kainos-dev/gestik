// src/features/deudas/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
    IntegranteSchema,
    IntegranteInput,
    DeudaSchema,
    DeudaInput,
    ReposicionDeudaSchema,
    ReposicionDeudaInput,
} from './schema';
import { calcularMontoReposicion } from './services';

export async function crearIntegrante(data: IntegranteInput) {
    const parsed = IntegranteSchema.parse(data);
    await pool.query(`INSERT INTO integrantes (nombre) VALUES ($1)`, [parsed.nombre]);
    revalidatePath('/gastos');
}

export async function toggleIntegranteActivo(id: string) {
    await pool.query(`UPDATE integrantes SET activo = NOT activo, updated_at = now() WHERE id = $1`, [id]);
    revalidatePath('/gastos');
}

export async function crearDeuda(data: DeudaInput) {
    const parsed = DeudaSchema.parse(data);

    await pool.query(
        `INSERT INTO deudas (integrante_id, descripcion, monto_total, moneda, fecha, notas)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [parsed.integranteId, parsed.descripcion, parsed.montoTotal, parsed.moneda, parsed.fecha, parsed.notas ?? null]
    );

    revalidatePath('/gastos');
}

export async function editarDeuda(id: string, data: DeudaInput) {
    const parsed = DeudaSchema.parse(data);

    await pool.query(
        `UPDATE deudas
     SET integrante_id = $1, descripcion = $2, monto_total = $3, moneda = $4, fecha = $5, notas = $6, updated_at = now()
     WHERE id = $7`,
        [parsed.integranteId, parsed.descripcion, parsed.montoTotal, parsed.moneda, parsed.fecha, parsed.notas ?? null, id]
    );

    revalidatePath('/gastos');
}

export async function reponerDeuda(deudaId: string, data: ReposicionDeudaInput) {
    const parsed = ReposicionDeudaSchema.parse(data);

    const { rows } = await pool.query(`SELECT moneda FROM deudas WHERE id = $1`, [deudaId]);
    const deuda = rows[0];
    if (!deuda) throw new Error('La deuda no existe');

    if (parsed.monedaPago !== deuda.moneda && !parsed.tipoCambio) {
        throw new Error('Falta el tipo de cambio para convertir la reposición');
    }

    const monto = calcularMontoReposicion(parsed.montoPagado, parsed.monedaPago, deuda.moneda, parsed.tipoCambio);

    await pool.query(
        `INSERT INTO reposiciones_deuda (deuda_id, monto, moneda_pago, monto_pagado, tipo_cambio, fecha, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            deudaId,
            monto,
            parsed.monedaPago,
            parsed.montoPagado,
            parsed.monedaPago !== deuda.moneda ? parsed.tipoCambio : null,
            parsed.fecha,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}
