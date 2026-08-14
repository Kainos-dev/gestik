// src/features/gastos/components/gastos-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Gasto } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { EditarGastoDialog } from './edit-gasto-dialog';
import { CATEGORIA_GASTO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

const columns: ColumnDef<Gasto>[] = [
    { accessorKey: 'fecha', header: 'Fecha', cell: ({ row }) => formatDate(row.original.fecha) },
    { accessorKey: 'descripcion', header: 'Descripción' },
    {
        accessorKey: 'categoria',
        header: 'Categoría',
        cell: ({ row }) => CATEGORIA_GASTO_LABELS[row.original.categoria],
    },
    {
        accessorKey: 'monto',
        header: 'Monto',
        cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda),
    },
    {
        accessorKey: 'gastoFijoNombre',
        header: 'Gasto fijo',
        cell: ({ row }) => row.original.gastoFijoNombre ?? '—',
    },
    {
        id: 'acciones',
        header: '',
        cell: ({ row }) => <EditarGastoDialog gasto={row.original} />,
    },
];

export function GastosTable({ gastos }: { gastos: Gasto[] }) {
    return <DataTable columns={columns} data={gastos} searchPlaceholder="Buscar gasto..." />;
}
