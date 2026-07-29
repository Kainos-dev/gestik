// src/features/servicios/actions.ts
"use server";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ServicioSchema, ServicioInput } from "./schema";
import { calcularProximoVencimiento } from "./services";

export async function crearServicio(data: ServicioInput) {
  const parsed = ServicioSchema.parse(data);
  const proximoVencimiento = calcularProximoVencimiento(
    parsed.fechaInicio,
    parsed.frecuencia,
  );

  console.log(parsed);
  console.log(parsed.tipo);

  await pool.query(
    `INSERT INTO servicios (cliente_id, tipo, nombre_personalizado, precio, frecuencia, fecha_inicio, proximo_vencimiento)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      parsed.clienteId,
      parsed.tipo,
      parsed.nombrePersonalizado ?? null,
      parsed.precio,
      parsed.frecuencia,
      parsed.fechaInicio,
      proximoVencimiento,
    ],
  );

  revalidatePath("/servicios");
  revalidatePath(`/clientes/${parsed.clienteId}`);
}

export async function editarServicio(id: string, data: ServicioInput) {
  const parsed = ServicioSchema.parse(data);
  const proximoVencimiento = calcularProximoVencimiento(
    parsed.fechaInicio,
    parsed.frecuencia,
  );

  await pool.query(
    `UPDATE servicios
     SET tipo = $1, nombre_personalizado = $2, precio = $3, frecuencia = $4,
         fecha_inicio = $5, proximo_vencimiento = $6, estado = COALESCE($7, estado),
         updated_at = now()
     WHERE id = $8`,
    [
      parsed.tipo,
      parsed.nombrePersonalizado ?? null,
      parsed.precio,
      parsed.frecuencia,
      parsed.fechaInicio,
      proximoVencimiento,
      parsed.estado,
      id,
    ],
  );

  revalidatePath("/servicios");
  revalidatePath(`/clientes/${parsed.clienteId}`);
}
