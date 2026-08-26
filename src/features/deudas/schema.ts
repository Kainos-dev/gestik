// src/features/deudas/schema.ts
import { z } from 'zod';
import { MONEDAS } from '@/lib/moneda';

const optionalString = (max: number) =>
    z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().max(max).optional()
    );

export const IntegranteSchema = z.object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
});

export type IntegranteInput = z.input<typeof IntegranteSchema>;

// Deuda: una compra/inversión pagada con plata propia de un integrante.
export const DeudaSchema = z.object({
    integranteId: z.string().min(1, 'Elegí quién puso la plata'),
    descripcion: z.string().trim().min(2, 'La descripción debe tener al menos 2 caracteres').max(200),
    montoTotal: z.coerce.number().positive('El monto debe ser mayor a 0'),
    moneda: z.enum(MONEDAS),
    fecha: z.coerce.date(),
    notas: optionalString(2000),
});

export type DeudaInput = z.input<typeof DeudaSchema>;

// Reposición: cada vez que se le devuelve plata a un integrante por una
// deuda. tipoCambio es obligatorio sólo cuando monedaPago difiere de la
// moneda de la deuda — eso el schema no lo puede saber (no conoce la deuda),
// así que esa validación vive en el server action (ver reponerDeuda).
export const ReposicionDeudaSchema = z.object({
    montoPagado: z.coerce.number().positive('El monto debe ser mayor a 0'),
    monedaPago: z.enum(MONEDAS),
    tipoCambio: z.coerce.number().positive().optional(),
    fecha: z.coerce.date(),
    notas: optionalString(2000),
});

export type ReposicionDeudaInput = z.input<typeof ReposicionDeudaSchema>;
