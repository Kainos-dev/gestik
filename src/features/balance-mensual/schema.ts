// src/features/balance-mensual/schema.ts
import { z } from 'zod';

// Carga manual del tipo de cambio (ARS por USD) para poder generar el
// reparto de un mes que tuvo Facturado en USD — ver domain model, PD1.
export const TipoCambioMensualSchema = z.object({
    mes: z.coerce.date(),
    tipoCambio: z.coerce.number().positive('Ingresá un tipo de cambio válido'),
});

export type TipoCambioMensualInput = z.input<typeof TipoCambioMensualSchema>;

// Ingreso o retiro manual de "Plata disponible en cuenta" o de "Caja de
// ahorro" (tabla movimientos_cuenta). Siempre en pesos; el monto va positivo
// y el tipo decide si suma o resta. CUENTAS_MANUALES espeja el enum
// origen_fondos de Postgres.
export const TIPOS_MOVIMIENTO_MANUAL = ['INGRESO', 'RETIRO'] as const;
export const CUENTAS_MANUALES = ['CUENTA', 'CAJA_AHORRO'] as const;

export const MovimientoCuentaSchema = z.object({
    tipo: z.enum(TIPOS_MOVIMIENTO_MANUAL),
    cuenta: z.enum(CUENTAS_MANUALES),
    monto: z.coerce.number().positive('Ingresá un monto mayor a 0'),
    fecha: z.coerce.date(),
    descripcion: z.string().trim().max(200).optional(),
});

export type MovimientoCuentaInput = z.input<typeof MovimientoCuentaSchema>;
