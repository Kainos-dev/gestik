// src/features/servicios/queries.ts
import { pool } from "@/lib/db";
import { Servicio, mapServicio } from "./types";

// Listado global (para /servicios) con el nombre del cliente vía JOIN
export async function getServicios(): Promise<Servicio[]> {
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS cliente_nombre, c.color AS cliente_color
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     ORDER BY s.proximo_vencimiento ASC NULLS LAST`,
  );
  return rows.map(mapServicio);
}

// Servicios de un cliente puntual (para el tab "Servicios" del detalle de cliente)
export async function getServiciosByCliente(
  clienteId: string,
): Promise<Servicio[]> {
  const { rows } = await pool.query(
    `SELECT * FROM servicios WHERE cliente_id = $1 ORDER BY fecha_inicio DESC`,
    [clienteId],
  );
  return rows.map(mapServicio);
}

export async function getServicioById(id: string): Promise<Servicio | null> {
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS cliente_nombre, c.color AS cliente_color
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     WHERE s.id = $1`,
    [id],
  );
  return rows[0] ? mapServicio(rows[0]) : null;
}
