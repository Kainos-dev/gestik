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
        `INSERT INTO gastos_fijos (nombre, categoria, monto, moneda, frecuencia, fecha_inicio, proximo_vencimiento, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            parsed.nombre,
            parsed.categoria,
            parsed.monto,
            parsed.moneda,
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
     SET nombre = $1, categoria = $2, monto = $3, moneda = $4, frecuencia = $5, fecha_inicio = $6,
         proximo_vencimiento = $7, estado = COALESCE($8, estado), notas = $9, updated_at = now()
     WHERE id = $10`,
        [
            parsed.nombre,
            parsed.categoria,
            parsed.monto,
            parsed.moneda,
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

// Genera el gasto del período vigente de "gastoFijo" (fila cruda de la tabla,
// snake_case) y avanza su proximo_vencimiento. Compartido entre "Registrar
// este mes" (un ciclo) y la renovación automática del cron (posible catch-up
// de varios ciclos) — mismo patrón que renovarUnCiclo en services/actions.ts.
async function renovarUnCicloGasto(gastoFijo: any): Promise<Date> {
    const fechaBase = gastoFijo.proximo_vencimiento ?? gastoFijo.fecha_inicio;
    const nuevoVencimiento = calcularProximoVencimiento(new Date(fechaBase), gastoFijo.frecuencia);

    await pool.query(
        `INSERT INTO gastos (gasto_fijo_id, categoria, descripcion, monto, moneda, fecha)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [gastoFijo.id, gastoFijo.categoria, gastoFijo.nombre, gastoFijo.monto, gastoFijo.moneda, fechaBase]
    );

    await pool.query(`UPDATE gastos_fijos SET proximo_vencimiento = $1, updated_at = now() WHERE id = $2`, [
        nuevoVencimiento,
        gastoFijo.id,
    ]);

    return nuevoVencimiento;
}

// Acción rápida: registra el gasto del período actual para un gasto fijo
// (ej. "Adobe" de este mes) y avanza su próximo vencimiento — así se anota
// mes a mes sin tener que completar el formulario completo cada vez.
export async function registrarGastoDelMes(gastoFijoId: string) {
    const { rows } = await pool.query(`SELECT * FROM gastos_fijos WHERE id = $1`, [gastoFijoId]);
    const gastoFijo = rows[0];
    if (!gastoFijo) return;

    await renovarUnCicloGasto(gastoFijo);

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}

// Se llama desde el cron diario (/api/cron/renovar-gastos-fijos): recorre
// todo gasto fijo ACTIVO cuyo próximo vencimiento ya llegó y genera el/los
// gasto(s) correspondientes — mismo patrón (incluido el catch-up) que
// renovarServiciosVencidos en services/actions.ts.
const MAX_CICLOS_CATCH_UP = 24;

export async function renovarGastosFijosVencidos() {
    const { rows } = await pool.query(
        `SELECT * FROM gastos_fijos WHERE estado = 'ACTIVO' AND proximo_vencimiento <= now()`
    );

    let gastosCreados = 0;
    const errores: { gastoFijoId: string; error: string }[] = [];
    const renovados: string[] = [];

    for (const gastoFijo of rows) {
        try {
            let vencimiento = new Date(gastoFijo.proximo_vencimiento);
            let ciclos = 0;

            while (vencimiento.getTime() <= Date.now() && ciclos < MAX_CICLOS_CATCH_UP) {
                vencimiento = await renovarUnCicloGasto({ ...gastoFijo, proximo_vencimiento: vencimiento });
                gastosCreados++;
                ciclos++;
            }

            if (ciclos > 0) renovados.push(gastoFijo.id);
        } catch (err) {
            errores.push({ gastoFijoId: gastoFijo.id, error: err instanceof Error ? err.message : String(err) });
        }
    }

    if (gastosCreados > 0) {
        revalidatePath('/gastos');
        revalidatePath('/gestion');
    }

    return { renovados: renovados.length, gastosCreados, errores };
}

// El gasto hereda la moneda del gasto fijo cuando está asociado a uno, igual
// que un pago hereda la del servicio — ver resolverMoneda en pagos/actions.ts.
async function resolverMonedaGasto(gastoFijoId: string | undefined, monedaForm: 'ARS' | 'USD') {
    if (!gastoFijoId) return monedaForm;
    const { rows } = await pool.query(`SELECT moneda FROM gastos_fijos WHERE id = $1`, [gastoFijoId]);
    return rows[0]?.moneda ?? monedaForm;
}

export async function crearGasto(data: GastoInput) {
    const parsed = GastoSchema.parse(data);
    const moneda = await resolverMonedaGasto(parsed.gastoFijoId, parsed.moneda);

    await pool.query(
        `INSERT INTO gastos (gasto_fijo_id, categoria, descripcion, monto, moneda, fecha, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            parsed.gastoFijoId ?? null,
            parsed.categoria,
            parsed.descripcion,
            parsed.monto,
            moneda,
            parsed.fecha,
            parsed.notas ?? null,
        ]
    );

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}

export async function editarGasto(id: string, data: GastoInput) {
    const parsed = GastoSchema.parse(data);
    const moneda = await resolverMonedaGasto(parsed.gastoFijoId, parsed.moneda);

    await pool.query(
        `UPDATE gastos
     SET gasto_fijo_id = $1, categoria = $2, descripcion = $3, monto = $4, moneda = $5, fecha = $6, notas = $7, updated_at = now()
     WHERE id = $8`,
        [
            parsed.gastoFijoId ?? null,
            parsed.categoria,
            parsed.descripcion,
            parsed.monto,
            moneda,
            parsed.fecha,
            parsed.notas ?? null,
            id,
        ]
    );

    revalidatePath('/gastos');
    revalidatePath('/gestion');
}
