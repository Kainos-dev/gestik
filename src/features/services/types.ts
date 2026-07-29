// src/features/servicios/types.ts
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

export interface Servicio {
  id: string;
  clienteId: string;
  clienteNombre?: string; // sólo viene poblado cuando la query hace JOIN (listado global)
  tipo: TipoServicio;
  nombrePersonalizado: string | null;
  precio: number;
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
    tipo: row.tipo,
    nombrePersonalizado: row.nombre_personalizado,
    precio: Number(row.precio),
    frecuencia: row.frecuencia,
    fechaInicio: row.fecha_inicio,
    proximoVencimiento: row.proximo_vencimiento,
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
