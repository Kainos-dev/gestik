// src/features/servicios/schema.ts
import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().trim().max(max).optional()
  );

export const TIPOS_SERVICIO = [
  "DESARROLLO_WEB",
  "MARKETING",
  "HOSTING",
  "SEO",
  "DISENO",
  "MANTENIMIENTO",
  "OTRO",
] as const;

export const FRECUENCIAS_SERVICIO = ["UNICO", "MENSUAL", "ANUAL"] as const;
export const ESTADOS_SERVICIO = ["ACTIVO", "PAUSADO", "FINALIZADO"] as const;

export const ServicioSchema = z
  .object({
    clienteId: z.string().min(1, 'Seleccioná un cliente'),
    tipo: z.enum(TIPOS_SERVICIO),
    nombrePersonalizado: optionalString(120),
    precio: z.coerce.number().positive('El precio debe ser mayor a 0'),
    frecuencia: z.enum(FRECUENCIAS_SERVICIO),
    fechaInicio: z.coerce.date(),
    estado: z.enum(ESTADOS_SERVICIO).optional(),
  })
  .refine((data) => data.tipo !== 'OTRO' || Boolean(data.nombrePersonalizado), {
    message: 'Especificá el nombre cuando el tipo es "Otro"',
    path: ['nombrePersonalizado'],
  });

export type ServicioInput = z.infer<typeof ServicioSchema>;
