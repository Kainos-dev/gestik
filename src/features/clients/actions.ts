// src/features/clientes/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { CrearClienteSchema, EditarClienteSchema, ClienteInput, ClienteUpdateInput } from './schema';

export async function crearCliente(data: ClienteInput) {
    const parsed = CrearClienteSchema.parse(data);

    await pool.query(
        `INSERT INTO clientes (nombre, empresa, email, whatsapp, observaciones)
     VALUES ($1, $2, $3, $4, $5)`,
        [parsed.nombre, parsed.empresa ?? null, parsed.email ?? null, parsed.whatsapp ?? null, parsed.observaciones ?? null]
    );

    revalidatePath('/clientes');
}

export async function editarCliente(id: string, data: ClienteUpdateInput) {
    const parsed = EditarClienteSchema.parse(data);

    await pool.query(
        `UPDATE clientes
     SET nombre = COALESCE($1, nombre),
         empresa = COALESCE($2, empresa),
         email = COALESCE($3, email),
         whatsapp = COALESCE($4, whatsapp),
         observaciones = COALESCE($5, observaciones),
         estado = COALESCE($6, estado),
         updated_at = now()
     WHERE id = $7`,
        [parsed.nombre, parsed.empresa, parsed.email, parsed.whatsapp, parsed.observaciones, parsed.estado, id]
    );

    revalidatePath('/clientes');
    revalidatePath(`/clientes/${id}`);
}