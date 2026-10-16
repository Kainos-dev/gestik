// src/features/gastos/types.ts
import { Moneda } from '@/lib/moneda';
import { ORIGENES_FONDOS } from './schema';

export type OrigenFondos = (typeof ORIGENES_FONDOS)[number];

export type CategoriaGasto =
    | 'SOFTWARE'
    | 'HOSTING'
    | 'EQUIPAMIENTO'
    | 'MARKETING'
    | 'IMPUESTOS'
    | 'OFICINA'
    | 'OTRO';

export type FrecuenciaGasto = 'MENSUAL' | 'MENSUAL_30_DIAS' | 'ANUAL';
export type EstadoGastoFijo = 'ACTIVO' | 'PAUSADO' | 'FINALIZADO';

// Estado de pago calculado (no se guarda en la DB), separado del ciclo de
// vida (EstadoGastoFijo) — ver calcularEstadoPagoGastoFijo en services.ts.
export type EstadoPagoGastoFijo = 'AL_DIA' | 'VENCIDO';

export interface GastoFijo {
    id: string;
    nombre: string;
    categoria: CategoriaGasto;
    monto: number;
    moneda: Moneda;
    frecuencia: FrecuenciaGasto;
    fechaInicio: Date;
    proximoVencimiento: Date | null;
    estado: EstadoGastoFijo;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export function mapGastoFijo(row: any): GastoFijo {
    return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria,
        monto: Number(row.monto),
        moneda: row.moneda,
        frecuencia: row.frecuencia,
        fechaInicio: row.fecha_inicio,
        proximoVencimiento: row.proximo_vencimiento,
        estado: row.estado,
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface Gasto {
    id: string;
    gastoFijoId: string | null;
    gastoFijoNombre?: string; // sólo viene poblado cuando la query hace JOIN
    categoria: CategoriaGasto;
    descripcion: string;
    monto: number;
    moneda: Moneda;
    fecha: Date;
    // null sólo en gastos sueltos cargados antes de que existiera el campo
    // (no se descuentan de ninguna cuenta) — ver migración agregar-origen-fondos-a-gastos.
    origenFondos: OrigenFondos | null;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export function mapGasto(row: any): Gasto {
    return {
        id: row.id,
        gastoFijoId: row.gasto_fijo_id,
        gastoFijoNombre: row.gasto_fijo_nombre ?? undefined,
        categoria: row.categoria,
        descripcion: row.descripcion,
        monto: Number(row.monto),
        moneda: row.moneda,
        fecha: row.fecha,
        origenFondos: row.origen_fondos,
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
