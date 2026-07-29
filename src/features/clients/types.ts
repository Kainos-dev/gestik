// src/features/clientes/types.ts
export type EstadoCliente = 'ACTIVO' | 'PAUSADO' | 'FINALIZADO';

export interface Cliente {
    id: string;
    nombre: string;
    empresa: string | null;
    email: string | null;
    whatsapp: string | null;
    estado: EstadoCliente;
    fechaAlta: Date;
    observaciones: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Postgres devuelve las columnas en snake_case; esto las mapea a nuestro tipo en camelCase
export function mapCliente(row: any): Cliente {
    return {
        id: row.id,
        nombre: row.nombre,
        empresa: row.empresa,
        email: row.email,
        whatsapp: row.whatsapp,
        estado: row.estado,
        fechaAlta: row.fecha_alta,
        observaciones: row.observaciones,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}