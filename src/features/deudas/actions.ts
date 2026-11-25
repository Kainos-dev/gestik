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
import { resolverCotizacionBlue } from '@/lib/cotizacion-dolar';
import { dateToSqlDateString } from '@/lib/utils';

// Las acciones que tienen que explicarle algo puntual al usuario devuelven
// un resultado en vez de tirar: en producción Next.js reemplaza el mensaje
// de cualquier error tirado en un server action por uno genérico.
export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function revalidarDeudas() {
    revalidatePath('/gastos');
    revalidatePath('/gestion');
    revalidatePath('/dashboard');
}

// ─── Integrantes ────────────────────────────────────────────────────────────

// "Juan", " juan " y "JUAN" son la misma persona: se compara sin mayúsculas
// ni espacios de más para no crear duplicados por accidente.
async function existeIntegranteConNombre(nombre: string, excluirId?: string): Promise<boolean> {
    const { rows } = await pool.query(
        `SELECT 1 FROM integrantes
     WHERE lower(btrim(nombre)) = lower(btrim($1)) AND ($2::text IS NULL OR id <> $2)
     LIMIT 1`,
        [nombre, excluirId ?? null]
    );
    return rows.length > 0;
}

export async function crearIntegrante(data: IntegranteInput): Promise<ResultadoAccion> {
    const parsed = IntegranteSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nombre inválido' };

    if (await existeIntegranteConNombre(parsed.data.nombre)) {
        return { ok: false, error: `Ya existe una persona llamada "${parsed.data.nombre}"` };
    }

    await pool.query(`INSERT INTO integrantes (nombre) VALUES ($1)`, [parsed.data.nombre]);
    revalidatePath('/gastos');
    return { ok: true };
}

// Cambiar el nombre no toca ninguna deuda: todas referencian a la persona por
// id, así que el nombre nuevo se ve solo en todas sus deudas e historiales.
export async function editarIntegrante(id: string, data: IntegranteInput): Promise<ResultadoAccion> {
    const parsed = IntegranteSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nombre inválido' };

    if (await existeIntegranteConNombre(parsed.data.nombre, id)) {
        return { ok: false, error: `Ya existe otra persona llamada "${parsed.data.nombre}"` };
    }

    const { rowCount } = await pool.query(
        `UPDATE integrantes SET nombre = $1, updated_at = now() WHERE id = $2`,
        [parsed.data.nombre, id]
    );
    if (!rowCount) return { ok: false, error: 'La persona no existe' };

    revalidarDeudas();
    return { ok: true };
}

export async function toggleIntegranteActivo(id: string) {
    await pool.query(`UPDATE integrantes SET activo = NOT activo, updated_at = now() WHERE id = $1`, [id]);
    revalidatePath('/gastos');
}

// Sólo se borra una persona SIN ninguna deuda (ni siquiera eliminadas):
// borrarla dejaría sus deudas y reposiciones sin "quién puso la plata". La
// condición va en el mismo DELETE para que no haya ventana entre chequear y
// borrar; además la FK deudas → integrantes (sin cascade) lo impide igual.
// Con deudas, la alternativa segura es "Desactivar".
export async function eliminarIntegrante(id: string): Promise<ResultadoAccion> {
    const { rowCount } = await pool.query(
        `DELETE FROM integrantes i
     WHERE i.id = $1 AND NOT EXISTS (SELECT 1 FROM deudas d WHERE d.integrante_id = i.id)`,
        [id]
    );

    if (!rowCount) {
        const { rows } = await pool.query(`SELECT count(*) AS n FROM deudas WHERE integrante_id = $1`, [id]);
        const n = Number(rows[0]?.n ?? 0);
        if (n > 0) {
            return {
                ok: false,
                error: `No se puede eliminar: tiene ${n} deuda${n === 1 ? '' : 's'} con su historial. Podés desactivarla para que no aparezca al cargar deudas nuevas.`,
            };
        }
        return { ok: false, error: 'La persona no existe' };
    }

    revalidatePath('/gastos');
    return { ok: true };
}

// ─── Deudas ─────────────────────────────────────────────────────────────────

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
     WHERE id = $7 AND eliminada_at IS NULL`,
        [parsed.integranteId, parsed.descripcion, parsed.montoTotal, parsed.moneda, parsed.fecha, parsed.notas ?? null, id]
    );

    revalidarDeudas();
}

// Eliminación lógica: la deuda se oculta pero NO se borra. Un DELETE real
// arrastraría sus reposiciones (ON DELETE CASCADE) y cambiaría "Plata
// disponible en cuenta" y el balance de Gestión, que las descuentan porque
// esa plata salió de verdad. Sólo afecta a la fila con ese id.
export async function eliminarDeuda(id: string): Promise<ResultadoAccion> {
    const { rowCount } = await pool.query(
        `UPDATE deudas SET eliminada_at = now(), updated_at = now() WHERE id = $1 AND eliminada_at IS NULL`,
        [id]
    );
    if (!rowCount) return { ok: false, error: 'La deuda no existe o ya estaba eliminada' };

    revalidarDeudas();
    return { ok: true };
}

export async function restaurarDeuda(id: string): Promise<ResultadoAccion> {
    const { rowCount } = await pool.query(
        `UPDATE deudas d SET eliminada_at = NULL, updated_at = now()
         WHERE id = $1 AND eliminada_at IS NOT NULL AND (to_jsonb(d)->>'deuda_reemplazo_id') IS NULL`,
        [id]
    );
    if (!rowCount) return { ok: false, error: 'La deuda no se puede restaurar. Revisá si fue convertida a otra moneda.' };

    revalidarDeudas();
    return { ok: true };
}

// La cotización (blue venta del día) se resuelve en @/lib/cotizacion-dolar,
// compartida con el registro de cobros de servicios en USD. El formulario la
// muestra con obtenerCotizacionBlue (@/lib/cotizacion-dolar-actions).

// ─── Reposiciones ───────────────────────────────────────────────────────────

export type ResultadoReposicion =
    | { ok: true; tipoCambio: number | null; montoAcreditado: number }
    | { ok: false; error: string };

export async function reponerDeuda(deudaId: string, data: ReposicionDeudaInput): Promise<ResultadoReposicion> {
    const parsed = ReposicionDeudaSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    const reposicion = parsed.data;

    const { rows } = await pool.query(`SELECT moneda FROM deudas WHERE id = $1 AND eliminada_at IS NULL`, [deudaId]);
    const deuda = rows[0];
    if (!deuda) return { ok: false, error: 'La deuda no existe o fue eliminada' };

    // La cotización la decide el servidor (blue venta del día del pago), no
    // el formulario: se guarda junto a la reposición y no se recalcula nunca,
    // así cada pago conserva la cotización con la que se registró.
    let tipoCambio: number | null = null;
    if (reposicion.monedaPago !== deuda.moneda) {
        const cotizacion = await resolverCotizacionBlue(dateToSqlDateString(reposicion.fecha));
        if (!cotizacion.ok) return cotizacion;
        tipoCambio = cotizacion.venta;
    }

    // Redondeado a centavos igual que la columna (numeric(12,2)): lo que se
    // muestra en el aviso de éxito es exactamente lo que queda guardado.
    const monto =
        Math.round(calcularMontoReposicion(reposicion.montoPagado, reposicion.monedaPago, deuda.moneda, tipoCambio) * 100) / 100;
    if (!(monto > 0)) return { ok: false, error: 'El monto es demasiado chico para acreditar a la deuda' };

    // Volver a comprobar la deuda bajo bloqueo por si se archivó o cambió
    // mientras se resolvía la cotización.
    const { rowCount } = await pool.query(
        `INSERT INTO reposiciones_deuda (deuda_id, monto, moneda_pago, monto_pagado, tipo_cambio, fecha, notas)
     SELECT d.id, $2, $3, $4, $5, $6, $7
     FROM deudas d
     WHERE d.id = $1 AND d.eliminada_at IS NULL AND d.moneda = $8
     FOR UPDATE`,
        [
            deudaId,
            monto,
            reposicion.monedaPago,
            reposicion.montoPagado,
            tipoCambio,
            reposicion.fecha,
            reposicion.notas ?? null,
            deuda.moneda,
        ]
    );
    if (!rowCount) return { ok: false, error: 'La deuda se archivó o cambió de moneda. Volvé a abrir el formulario.' };

    revalidarDeudas();
    return { ok: true, tipoCambio, montoAcreditado: monto };
}
