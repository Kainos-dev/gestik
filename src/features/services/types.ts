// src/features/servicios/types.ts
import { Moneda } from "@/lib/moneda";

export type TipoServicio =
  | "DESARROLLO_WEB"
  | "MARKETING"
  | "HOSTING"
  | "SEO"
  | "DISENO"
  | "MANTENIMIENTO"
  | "OTRO";

export type FrecuenciaServicio = "UNICO" | "MENSUAL" | "ANUAL";
export type EstadoServicio = "ACTIVO" | "PAUSADO" | "FINALIZADO";

// Estado de renovación calculado (no se guarda en la DB), separado del
// ciclo de vida (EstadoServicio) — ver calcularEstadoRenovacion en services.ts.
export type EstadoRenovacionServicio = "AL_DIA" | "VENCIDO";

export interface Servicio {
  id: string;
  clienteId: string;
  clienteNombre?: string; // sólo viene poblado cuando la query hace JOIN (listado global)
  clienteColor?: string;
  tipo: TipoServicio;
  nombrePersonalizado: string | null;
  precio: number;
  moneda: Moneda;
  frecuencia: FrecuenciaServicio;
  fechaInicio: Date;
  proximoVencimiento: Date | null;
  estado: EstadoServicio;
  createdAt: Date;
  updatedAt: Date;
}

export function mapServicio(row: any): Servicio {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre ?? undefined,
    clienteColor: row.cliente_color ?? undefined,
    tipo: row.tipo,
    nombrePersonalizado: row.nombre_personalizado,
    precio: Number(row.precio),
    moneda: row.moneda,
    frecuencia: row.frecuencia,
    fechaInicio: row.fecha_inicio,
    proximoVencimiento: row.proximo_vencimiento,
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
