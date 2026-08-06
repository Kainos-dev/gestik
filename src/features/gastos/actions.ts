// src/features/gastos/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { GastoFijoSchema, GastoFijoInput, GastoSchema, GastoInput } from './schema';
import { calcularProximoVencimiento } from './services';

export async function crearGastoFijo(data: GastoFijoInput) {
    const parsed = GastoFijoSchema.parse(data);
    const proximoVencimiento = calcularProximoVencimiento(parsed.fechaInicio, parsed.frecuencia);

    await pool.query(
        `INSERT INTO gastos_fijos (nombre, categoria, monto, frecuencia, fecha_inicio, proximo_vencimiento, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            parsed.nombre,
            parsed.categoria,
            parsed.monto,
            parsed.frecuencia,
            parsed.fechaInicio,
            proximoVencimiento,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/gastos');
}

export async function editarGastoFijo(id: string, data: GastoFijoInput) {
    const parsed = GastoFijoSchema.parse(data);
    const proximoVencimiento = calcularProximoVencimiento(parsed.fechaInicio, parsed.frecuencia);

    await pool.query(
        `UPDATE gastos_fijos
     SET nombre = $1, categoria = $2, monto = $3, frecuencia = $4, fecha_inicio = $5,
         proximo_vencimiento = $6, estado = COALESCE($7, estado), notas = $8, updated_at = now()
     WHERE id = $9`,
        [
            parsed.nombre,
            parsed.categoria,
            parsed.monto,
            parsed.frecuencia,
            parsed.fechaInicio,
            proximoVencimiento,
            parsed.estado,
            parsed.notas ?? null,
            id,
        ]
    );

    revalidatePath('/gastos');
}

// Acción rápida: registra el gasto del período actual para un gasto fijo
// (ej. "Adobe" de este mes) y avanza su próximo vencimiento — así se anota
// mes a mes sin tener que completar el formulario completo cada vez.
export async function registrarGastoDelMes(gastoFijoId: string) {
    const { rows } = await pool.query(`SELECT * FROM gastos_fijos WHERE id = $1`, [gastoFijoId]);
    const gastoFijo = rows[0];
    if (!gastoFijo) return;

    const fechaBase = gastoFijo.proximo_vencimiento ?? gastoFijo.fecha_inicio;
    const nuevoVencimiento = calcularProximoVencimiento(new Date(fechaBase), gastoFijo.frecuencia);

    await pool.query(
        `INSERT INTO gastos (gasto_fijo_id, categoria, descripcion, monto, fecha)
     VALUES ($1, $2, $3, $4, $5)`,
        [gastoFijo.id, gastoFijo.categoria, gastoFijo.nombre, gastoFijo.monto, fechaBase]
    );

    await pool.query(`UPDATE gastos_fijos SET proximo_vencimiento = $1, updated_at = now() WHERE id = $2`, [
        nuevoVencimiento,
        gastoFijoId,
    ]);

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}

export async function crearGasto(data: GastoInput) {
    const parsed = GastoSchema.parse(data);

    await pool.query(
        `INSERT INTO gastos (gasto_fijo_id, categoria, descripcion, monto, fecha, notas)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            parsed.gastoFijoId ?? null,
            parsed.categoria,
            parsed.descripcion,
            parsed.monto,
            parsed.fecha,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}

export async function editarGasto(id: string, data: GastoInput) {
    const parsed = GastoSchema.parse(data);

    await pool.query(
        `UPDATE gastos
     SET gasto_fijo_id = $1, categoria = $2, descripcion = $3, monto = $4, fecha = $5, notas = $6, updated_at = now()
     WHERE id = $7`,
        [
            parsed.gastoFijoId ?? null,
            parsed.categoria,
            parsed.descripcion,
            parsed.monto,
            parsed.fecha,
            parsed.notas ?? null,
            id,
        ]
    );

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}
