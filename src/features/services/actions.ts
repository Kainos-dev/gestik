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


export async function renovarServicio(servicioId: string) {
  const { rows } = await pool.query(`SELECT * FROM servicios WHERE id = $1`, [servicioId]);
  const servicio = rows[0];
  if (!servicio || servicio.frecuencia === 'UNICO') return;

  const fechaBase = servicio.proximo_vencimiento ?? servicio.fecha_inicio;
  const nuevoVencimiento = calcularProximoVencimiento(new Date(fechaBase), servicio.frecuencia);

  // 1. Genera el pago pendiente correspondiente a este período
  await pool.query(
    `INSERT INTO pagos (cliente_id, servicio_id, fecha, monto, metodo_pago, estado)
     VALUES ($1, $2, $3, $4, 'TRANSFERENCIA', 'PENDIENTE')`,
    [servicio.cliente_id, servicio.id, fechaBase, servicio.precio]
  );

  // 2. Avanza el vencimiento del servicio al siguiente ciclo
  await pool.query(`UPDATE servicios SET proximo_vencimiento = $1, updated_at = now() WHERE id = $2`, [
    nuevoVencimiento,
    servicioId,
  ]);

  revalidatePath('/servicios');
  revalidatePath('/pagos');
  revalidatePath('/finanzas');
}