// src/features/balance-mensual/schema.ts
import { z } from 'zod';

// Carga manual del tipo de cambio (ARS por USD) para poder generar el
// reparto de un mes que tuvo Facturado en USD — ver domain model, PD1.
export const TipoCambioMensualSchema = z.object({
    mes: z.coerce.date(),
    tipoCambio: z.coerce.number().positive('Ingresá un tipo de cambio válido'),
});

export type TipoCambioMensualInput = z.input<typeof TipoCambioMensualSchema>;
