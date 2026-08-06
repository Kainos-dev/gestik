// src/features/pagos/components/pagos-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Pago } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { METODO_PAGO_LABELS, TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

const columns: ColumnDef<Pago>[] = [
    {
        accessorKey: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => formatDate(row.original.fecha),
    },
    { accessorKey: 'clienteNombre', header: 'Cliente' },
    {
        accessorKey: 'monto',
        header: 'Monto',
        cell: ({ row }) =>
            new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(row.original.monto),
    },
    {
        accessorKey: 'metodoPago',
        header: 'Método',
        cell: ({ row }) => METODO_PAGO_LABELS[row.original.metodoPago],
    },
    {
        accessorKey: 'servicioNombre',
        header: 'Servicio',
        cell: ({ row }) => {
            const tipo = row.original.servicioNombre;
            if (!tipo) return '—';
            return TIPO_SERVICIO_LABELS[tipo] ?? tipo;
        },
    },
];

export function PagosTable({ pagos }: { pagos: Pago[] }) {
    return <DataTable columns={columns} data={pagos} searchPlaceholder="Buscar por cliente..." />;
}