// src/features/clientes/schema.ts
import { z } from 'zod';

const optionalString = (max: number) =>
    z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().max(max).optional()
    );

// Reutilizamos el mismo enum de la base de datos, como single source of truth
export const ESTADOS_CLIENTE = ['ACTIVO', 'PAUSADO', 'FINALIZADO'] as const;

// ANTICIPADO: paga antes de arrancar el mes de trabajo. POSPAGO: paga al
// terminarlo (modalidad histórica, default para clientes ya existentes —
// ver migración agregar-modalidad-pago-a-clientes). A diferencia de estado
// y color, esto se elige en el alta (no tiene un valor automático), y
// después se puede corregir en la edición.
export const MODALIDADES_PAGO = ['ANTICIPADO', 'POSPAGO'] as const;

// Schema base con las reglas de negocio de cada campo
export const ClienteSchema = z.object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
    empresa: optionalString(120),
    email: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().email('Email inválido').optional()
    ),
    whatsapp: optionalString(30),
    modalidadPago: z.enum(MODALIDADES_PAGO),
    observaciones: optionalString(2000),
});

// Para alta: todos los campos de ClienteSchema, tal cual
export const CrearClienteSchema = ClienteSchema;

// Para edición: mismos campos, pero todos opcionales (permite update parcial)
// + el estado, que en alta no se pide (siempre nace ACTIVO), y el color,
// que en alta se asigna automático (ver pickClientColor) pero puede
// corregirse a mano después.
export const EditarClienteSchema = ClienteSchema.partial().extend({
    estado: z.enum(ESTADOS_CLIENTE).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').optional(),
});

// Tipos TS inferidos directamente del schema — no hay que mantenerlos a mano
export type ClienteInput = z.infer<typeof CrearClienteSchema>;
export type ClienteUpdateInput = z.infer<typeof EditarClienteSchema>;