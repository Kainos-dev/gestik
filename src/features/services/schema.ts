// src/features/servicios/schema.ts
import { z } from "zod";

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
    clienteId: z.string().min(1, "Seleccioná un cliente"),
    tipo: z.enum(TIPOS_SERVICIO),
    nombrePersonalizado: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    precio: z.coerce.number().positive("El precio debe ser mayor a 0"),
    frecuencia: z.enum(FRECUENCIAS_SERVICIO),
    fechaInicio: z.coerce.date(),
    estado: z.enum(ESTADOS_SERVICIO).optional(),
  })
  .refine((data) => data.tipo !== "OTRO" || Boolean(data.nombrePersonalizado), {
    message: 'Especificá el nombre cuando el tipo es "Otro"',
    path: ["nombrePersonalizado"],
  });

export type ServicioInput = z.infer<typeof ServicioSchema>;
