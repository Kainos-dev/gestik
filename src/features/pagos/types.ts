// src/features/pagos/types.ts
export type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO' | 'MERCADO_PAGO' | 'TARJETA' | 'OTRO';

export interface Pago {
    id: string;
    clienteId: string;
    clienteNombre?: string;
    servicioId: string | null;
    servicioNombre?: string;
    fecha: Date;
    monto: number;
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
        servicioId: row.servicio_id,
        servicioNombre: row.servicio_nombre ?? undefined,
        fecha: row.fecha,
        monto: Number(row.monto), // numeric viene como string desde pg
        metodoPago: row.metodo_pago,
        comprobanteUrl: row.comprobante_url,
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}