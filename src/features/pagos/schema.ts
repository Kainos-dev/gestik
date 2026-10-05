// src/features/pagos/schema.ts
import { z } from 'zod';
import { MONEDAS } from '@/lib/moneda';

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
    // Lo que el cliente efectivamente pagó. Si hay un servicio asociado y
    // paga en una moneda distinta a la del servicio, el server action lo
    // convierte con tipoCambio y acredita el cargo en la moneda del
    // servicio — mismo patrón que ReposicionDeudaSchema en deudas/schema.ts.
    montoPagado: z.coerce.number().positive('El monto debe ser mayor a 0'),
    monedaPago: z.enum(MONEDAS),
    // Obligatorio sólo cuando monedaPago difiere de la moneda del servicio
    // asociado — el schema no conoce el servicio, esa validación vive en
    // el server action (ver resolverConversion en pagos/actions.ts).
    tipoCambio: z.coerce.number().positive().optional(),
    metodoPago: z.enum(METODOS_PAGO),
    comprobanteUrl: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().trim().url('URL inválida').optional()
    ),
    notas: optionalString(2000),
});


export type PagoInput = z.input<typeof PagoSchema>;