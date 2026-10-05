// src/features/pagos/types.ts
import { Moneda } from '@/lib/moneda';

export type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO' | 'MERCADO_PAGO' | 'TARJETA' | 'OTRO';

export interface Pago {
    id: string;
    clienteId: string;
    clienteNombre?: string;
    clienteColor?: string;
    servicioId: string | null;
    servicioNombre?: string;
    fecha: Date;
    monto: number; // lo que se acredita al cargo, en la moneda del servicio (o la elegida, si es un pago suelto)
    moneda: Moneda;
    monedaPago: Moneda; // lo que realmente entró (puede diferir de "moneda" — ver tipoCambio)
    montoPagado: number; // monto en monedaPago
    tipoCambio: number | null; // sólo cuando monedaPago != moneda
    metodoPago: MetodoPago;
    comprobanteUrl: string | null;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export function mapPago(row: any): Pago {
    return {
        id: row.id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre ?? undefined,
        clienteColor: row.cliente_color ?? undefined,
        servicioId: row.servicio_id,
        servicioNombre: row.servicio_nombre ?? undefined,
        fecha: row.fecha,
        monto: Number(row.monto), // numeric viene como string desde pg
        moneda: row.moneda,
        monedaPago: row.moneda_pago,
        montoPagado: Number(row.monto_pagado),
        tipoCambio: row.tipo_cambio !== null ? Number(row.tipo_cambio) : null,
        metodoPago: row.metodo_pago,
        comprobanteUrl: row.comprobante_url,
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}