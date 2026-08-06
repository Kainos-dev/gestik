// src/features/cargos/types.ts
export type EstadoCargo = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO';

export interface Cargo {
    id: string;
    clienteId: string;
    clienteNombre?: string; // sólo viene poblado cuando la query hace JOIN
    servicioId: string;
    servicioTipo?: string;
    servicioNombrePersonalizado?: string | null;
    periodo: Date;
    monto: number;
    montoCubierto: number; // calculado en la query (waterfall de pagos), no se guarda
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export function mapCargo(row: any): Cargo {
    return {
        id: row.id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre ?? undefined,
        servicioId: row.servicio_id,
        servicioTipo: row.servicio_tipo ?? undefined,
        servicioNombrePersonalizado: row.servicio_nombre_personalizado ?? undefined,
        periodo: row.periodo,
        monto: Number(row.monto),
        montoCubierto: Number(row.monto_cubierto),
        notas: row.notas,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
