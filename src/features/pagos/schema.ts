// src/features/pagos/schema.ts
import { z } from 'zod';

const optionalString = (max: number) =>
    z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().max(max).optional()
    );


export const METODOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'MERCADO_PAGO', 'TARJETA', 'OTRO'] as const;

export const PagoSchema = z.object({
    clienteId: z.string().min(1, 'Seleccioná un cliente'),
    servicioId: optionalString(50),
    fecha: z.coerce.date(),
    monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
    metodoPago: z.enum(METODOS_PAGO),
    comprobanteUrl: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().url('URL inválida').optional()
    ),
    notas: optionalString(2000),
});


export type PagoInput = z.input<typeof PagoSchema>;