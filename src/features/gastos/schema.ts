// src/features/gastos/schema.ts
import { z } from 'zod';
import { MONEDAS } from '@/lib/moneda';

const optionalString = (max: number) =>
    z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().max(max).optional()
    );

export const CATEGORIAS_GASTO = [
    'SOFTWARE',
    'HOSTING',
    'EQUIPAMIENTO',
    'MARKETING',
    'IMPUESTOS',
    'OFICINA',
    'OTRO',
] as const;

export const FRECUENCIAS_GASTO = ['MENSUAL', 'MENSUAL_30_DIAS', 'ANUAL'] as const;
export const ESTADOS_GASTO_FIJO = ['ACTIVO', 'PAUSADO', 'FINALIZADO'] as const;
// De dónde sale la plata de un gasto — refleja el enum "origen_fondos" de
// Postgres (migración agregar-origen-fondos-a-gastos).
export const ORIGENES_FONDOS = ['CUENTA', 'CAJA_AHORRO'] as const;

// Gasto fijo: el compromiso recurrente (Adobe, hosting, etc.)
export const GastoFijoSchema = z.object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
    categoria: z.enum(CATEGORIAS_GASTO),
    monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
    moneda: z.enum(MONEDAS),
    frecuencia: z.enum(FRECUENCIAS_GASTO),
    fechaInicio: z.coerce.date(),
    estado: z.enum(ESTADOS_GASTO_FIJO).optional(),
    notas: optionalString(2000),
});

export type GastoFijoInput = z.input<typeof GastoFijoSchema>;

// Gasto: cada salida de plata real (puntual, o la cuota de un gasto fijo)
export const GastoSchema = z.object({
    gastoFijoId: optionalString(50),
    categoria: z.enum(CATEGORIAS_GASTO),
    descripcion: z.string().trim().min(2, 'La descripción debe tener al menos 2 caracteres').max(200),
    monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
    // Se usa solo cuando NO hay gastoFijoId: si lo hay, el server action usa
    // la moneda del gasto fijo (igual que pagos hereda la del servicio).
    moneda: z.enum(MONEDAS),
    fecha: z.coerce.date(),
    // Obligatorio: sin elegirlo no se puede cargar el gasto. La caja de
    // ahorro es sólo en pesos (ver ahorro_mes_ars), así que un gasto en USD
    // tiene que salir de la cuenta — el server action lo vuelve a validar
    // con la moneda ya resuelta (puede venir heredada de un gasto fijo).
    origenFondos: z.enum(ORIGENES_FONDOS, { error: 'Elegí si se paga con la cuenta o con la caja de ahorro' }),
    notas: optionalString(2000),
}).refine((g) => !(g.origenFondos === 'CAJA_AHORRO' && g.moneda !== 'ARS'), {
    message: 'La caja de ahorro es en pesos: un gasto en USD tiene que salir de la cuenta',
    path: ['origenFondos'],
});

export type GastoInput = z.input<typeof GastoSchema>;
