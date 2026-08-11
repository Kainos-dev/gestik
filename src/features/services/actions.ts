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

  const { rows } = await pool.query(
    `INSERT INTO servicios (cliente_id, tipo, nombre_personalizado, precio, moneda, frecuencia, fecha_inicio, proximo_vencimiento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      parsed.clienteId,
      parsed.tipo,
      parsed.nombrePersonalizado ?? null,
      parsed.precio,
      parsed.moneda,
      parsed.frecuencia,
      parsed.fechaInicio,
      proximoVencimiento,
    ],
  );

  // El primer período también genera su cargo, igual que "Renovar" hará con
  // los siguientes. Si es UNICO no hay "próximo período", así que vence en
  // el propio período (se debe apenas se emite).
  const vencimientoCargo = proximoVencimiento ?? parsed.fechaInicio;
  await pool.query(
    `INSERT INTO cargos (cliente_id, servicio_id, periodo, vencimiento, monto, moneda)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [parsed.clienteId, rows[0].id, parsed.fechaInicio, vencimientoCargo, parsed.precio, parsed.moneda],
  );

  revalidatePath("/servicios");
  revalidatePath("/pagos");
  revalidatePath("/gestion");
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
     SET tipo = $1, nombre_personalizado = $2, precio = $3, moneda = $4, frecuencia = $5,
         fecha_inicio = $6, proximo_vencimiento = $7, estado = COALESCE($8, estado),
         updated_at = now()
     WHERE id = $9`,
    [
      parsed.tipo,
      parsed.nombrePersonalizado ?? null,
      parsed.precio,
      parsed.moneda,
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


export async function renovarServicio(servicioId: string, nuevoPrecio?: number) {
  const { rows } = await pool.query(`SELECT * FROM servicios WHERE id = $1`, [servicioId]);
  const servicio = rows[0];
  if (!servicio || servicio.frecuencia === 'UNICO') return;
  if (servicio.estado !== 'ACTIVO') return;
  if (nuevoPrecio !== undefined && !(nuevoPrecio > 0)) {
    throw new Error('El precio debe ser mayor a 0');
  }

  const fechaBase = servicio.proximo_vencimiento ?? servicio.fecha_inicio;
  const nuevoVencimiento = calcularProximoVencimiento(new Date(fechaBase), servicio.frecuencia);
  const precio = nuevoPrecio ?? Number(servicio.precio);

  // 1. Genera el cargo correspondiente a este período (vence al arrancar el
  //    próximo, nunca es UNICO en este flujo — ver early return arriba), con
  //    el precio vigente al renovar (si se editó, se copia acá para siempre,
  //    igual que ya pasa con cualquier cargo)
  await pool.query(
    `INSERT INTO cargos (cliente_id, servicio_id, periodo, vencimiento, monto, moneda)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [servicio.cliente_id, servicio.id, fechaBase, nuevoVencimiento, precio, servicio.moneda]
  );

  // 2. Avanza el vencimiento del servicio al siguiente ciclo, y si el precio
  //    cambió lo actualiza para que los próximos ciclos también lo usen
  await pool.query(
    `UPDATE servicios SET proximo_vencimiento = $1, precio = $2, updated_at = now() WHERE id = $3`,
    [nuevoVencimiento, precio, servicioId],
  );

  revalidatePath('/servicios');
  revalidatePath('/pagos');
  revalidatePath('/gestion');
}