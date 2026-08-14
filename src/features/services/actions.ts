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

  const { rows } = await pool.query(
    `SELECT frecuencia, fecha_inicio, proximo_vencimiento FROM servicios WHERE id = $1`,
    [id],
  );
  const actual = rows[0];

  // Sólo recalculamos el próximo vencimiento si cambió lo que determina el
  // ciclo (frecuencia o fecha de inicio). Si sólo se edita precio/tipo/moneda/
  // estado, el próximo vencimiento —que puede haber avanzado por renovaciones
  // desde que se creó el servicio— queda intacto: de lo contrario cada edición
  // lo pisaba con "fecha_inicio + 1 ciclo", perdiendo todo el historial de
  // renovaciones (y confundiendo al cron de renovación automática).
  const cambioCiclo =
    !actual ||
    parsed.frecuencia !== actual.frecuencia ||
    parsed.fechaInicio.getTime() !== new Date(actual.fecha_inicio).getTime();

  const proximoVencimiento = cambioCiclo
    ? calcularProximoVencimiento(parsed.fechaInicio, parsed.frecuencia)
    : actual.proximo_vencimiento;

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


// Genera el cargo del período vigente de "servicio" (fila cruda de la tabla,
// snake_case) y avanza su proximo_vencimiento. Compartido entre la renovación
// manual (un ciclo) y la automática (posible catch-up de varios ciclos).
async function renovarUnCiclo(servicio: any, precio: number): Promise<Date> {
  const fechaBase = servicio.proximo_vencimiento ?? servicio.fecha_inicio;
  const nuevoVencimiento = calcularProximoVencimiento(new Date(fechaBase), servicio.frecuencia)!;

  // 1. Genera el cargo correspondiente a este período (vence al arrancar el
  //    próximo, nunca es UNICO en este flujo), con el precio vigente al
  //    renovar (si se editó, se copia acá para siempre, igual que ya pasa
  //    con cualquier cargo)
  await pool.query(
    `INSERT INTO cargos (cliente_id, servicio_id, periodo, vencimiento, monto, moneda)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [servicio.cliente_id, servicio.id, fechaBase, nuevoVencimiento, precio, servicio.moneda]
  );

  // 2. Avanza el vencimiento del servicio al siguiente ciclo, y si el precio
  //    cambió lo actualiza para que los próximos ciclos también lo usen
  await pool.query(
    `UPDATE servicios SET proximo_vencimiento = $1, precio = $2, updated_at = now() WHERE id = $3`,
    [nuevoVencimiento, precio, servicio.id],
  );

  return nuevoVencimiento;
}

export async function renovarServicio(servicioId: string, nuevoPrecio?: number) {
  const { rows } = await pool.query(`SELECT * FROM servicios WHERE id = $1`, [servicioId]);
  const servicio = rows[0];
  if (!servicio || servicio.frecuencia === 'UNICO') return;
  if (servicio.estado !== 'ACTIVO') return;
  if (nuevoPrecio !== undefined && !(nuevoPrecio > 0)) {
    throw new Error('El precio debe ser mayor a 0');
  }

  const precio = nuevoPrecio ?? Number(servicio.precio);
  await renovarUnCiclo(servicio, precio);

  revalidatePath('/servicios');
  revalidatePath('/pagos');
  revalidatePath('/gestion');
}

// Se llama desde el cron diario (/api/cron/renovar-servicios): recorre todo
// servicio ACTIVO, recurrente, cuyo próximo vencimiento ya llegó, y genera
// el/los cargo(s) correspondientes. Si el cron estuvo caído más de un ciclo,
// "hace catch-up" generando un cargo por cada período atrasado en vez de
// saltear los que se perdieron (tope de 24 ciclos por las dudas, para no
// colgarse si algo quedó mal configurado).
const MAX_CICLOS_CATCH_UP = 24;

export async function renovarServiciosVencidos() {
  const { rows } = await pool.query(
    `SELECT * FROM servicios
     WHERE estado = 'ACTIVO' AND frecuencia != 'UNICO' AND proximo_vencimiento <= now()`
  );

  let cargosCreados = 0;
  const errores: { servicioId: string; error: string }[] = [];
  const renovados: string[] = [];

  for (const servicio of rows) {
    try {
      const precio = Number(servicio.precio);
      let vencimiento = new Date(servicio.proximo_vencimiento);
      let ciclos = 0;

      while (vencimiento.getTime() <= Date.now() && ciclos < MAX_CICLOS_CATCH_UP) {
        vencimiento = await renovarUnCiclo({ ...servicio, proximo_vencimiento: vencimiento }, precio);
        cargosCreados++;
        ciclos++;
      }

      if (ciclos > 0) renovados.push(servicio.id);
    } catch (err) {
      errores.push({ servicioId: servicio.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (cargosCreados > 0) {
    revalidatePath('/servicios');
    revalidatePath('/pagos');
    revalidatePath('/gestion');
  }

  return { renovados: renovados.length, cargosCreados, errores };
}