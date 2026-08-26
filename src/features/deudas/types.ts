// src/features/deudas/types.ts
import { Moneda } from '@/lib/moneda';

export interface Integrante {
    id: string;
    nombre: string;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export function mapIntegrante(row: any): Integrante {
    return {
        id: row.id,
        nombre: row.nombre,
        activo: row.activo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Estado calculado (no se guarda en la DB) a partir de montoTotal vs.
// montoRepuesto — ver calcularEstadoDeuda en services.ts.
export type EstadoDeuda = 'ACTIVA' | 'SALDADA';

export interface Deuda {
    id: string;
    integranteId: string;
    integranteNombre?: string; // sólo viene poblado cuando la query hace JOIN
    descripcion: string;
    montoTotal: number;
    moneda: Moneda;
    montoRepuesto: number; // calculado en la query (SUM de reposiciones), no se guarda
    fecha: Date;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export function mapDeuda(row: any): Deuda {
    return {
        id: row.id,
        integranteId: row.integrante_id,
        integranteNombre: row.integrante_nombre ?? undefined,
        descripcion: row.descripcion,
        montoTotal: Number(row.monto_total),
        moneda: row.moneda,
        montoRepuesto: Number(row.monto_repuesto ?? 0),
        fecha: row.fecha,
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface ReposicionDeuda {
    id: string;
    deudaId: string;
    monto: number; // aplicado a la deuda, en la moneda de la deuda
    monedaPago: Moneda; // moneda que realmente salió del bolsillo
    montoPagado: number; // monto en monedaPago
    tipoCambio: number | null; // sólo cuando monedaPago != moneda de la deuda
    fecha: Date;
    notas: string | null;
    createdAt: Date;
}

export function mapReposicionDeuda(row: any): ReposicionDeuda {
    return {
        id: row.id,
        deudaId: row.deuda_id,
        monto: Number(row.monto),
        monedaPago: row.moneda_pago,
        montoPagado: Number(row.monto_pagado),
        tipoCambio: row.tipo_cambio !== null ? Number(row.tipo_cambio) : null,
        fecha: row.fecha,
        notas: row.notas,
        createdAt: row.created_at,
    };
}
