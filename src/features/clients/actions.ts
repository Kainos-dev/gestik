// src/features/clientes/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { CrearClienteSchema, EditarClienteSchema, ClienteInput, ClienteUpdateInput } from './schema';
import { pickClientColor } from '@/lib/client-colors';

export async function crearCliente(data: ClienteInput) {
    const parsed = CrearClienteSchema.parse(data);

    // Color asignado automático rotando la paleta según cuántos clientes ya
    // existen, para que dos altas seguidas no queden con el mismo color.
    const { rows } = await pool.query(`SELECT COUNT(*) AS total FROM clientes`);
    const color = pickClientColor(Number(rows[0].total));

    await pool.query(
        `INSERT INTO clientes (nombre, empresa, email, whatsapp, observaciones, color)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [parsed.nombre, parsed.empresa ?? null, parsed.email ?? null, parsed.whatsapp ?? null, parsed.observaciones ?? null, color]
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
         color = COALESCE($7, color),
         updated_at = now()
     WHERE id = $8`,
        [parsed.nombre, parsed.empresa, parsed.email, parsed.whatsapp, parsed.observaciones, parsed.estado, parsed.color, id]
    );

    revalidatePath('/clientes');
    revalidatePath(`/clientes/${id}`);
}