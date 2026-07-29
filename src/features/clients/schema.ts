// src/features/clientes/schema.ts
import { z } from 'zod';

// Reutilizamos el mismo enum de la base de datos, como single source of truth
export const ESTADOS_CLIENTE = ['ACTIVO', 'PAUSADO', 'FINALIZADO'] as const;

// Schema base con las reglas de negocio de cada campo
export const ClienteSchema = z.object({
    nombre: z
        .string()
        .trim()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(120, 'El nombre es demasiado largo'),

    empresa: z
        .string()
        .trim()
        .max(120)
        .optional()
        .or(z.literal('').transform(() => undefined)),

    email: z
        .string()
        .trim()
        .email('Email inválido')
        .optional()
        .or(z.literal('').transform(() => undefined)),

    whatsapp: z
        .string()
        .trim()
        .max(30)
        .optional()
        .or(z.literal('').transform(() => undefined)),

    observaciones: z
        .string()
        .trim()
        .max(2000, 'Máximo 2000 caracteres')
        .optional()
        .or(z.literal('').transform(() => undefined)),
});

// Para alta: todos los campos de ClienteSchema, tal cual
export const CrearClienteSchema = ClienteSchema;

// Para edición: mismos campos, pero todos opcionales (permite update parcial)
// + el estado, que en alta no se pide (siempre nace ACTIVO)
export const EditarClienteSchema = ClienteSchema.partial().extend({
    estado: z.enum(ESTADOS_CLIENTE).optional(),
});

// Tipos TS inferidos directamente del schema — no hay que mantenerlos a mano
export type ClienteInput = z.infer<typeof CrearClienteSchema>;
export type ClienteUpdateInput = z.infer<typeof EditarClienteSchema>;