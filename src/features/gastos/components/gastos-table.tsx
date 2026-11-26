// src/features/gastos/components/gastos-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Gasto } from '../types';
import type { ReactNode } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { EditarGastoDialog } from './edit-gasto-dialog';
import { CATEGORIA_GASTO_LABELS, ORIGEN_FONDOS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { MontoConMoneda } from '@/components/shared/monto-con-moneda';

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
        cell: ({ row }) => <MontoConMoneda monto={row.original.monto} moneda={row.original.moneda} />,
    },
    {
        accessorKey: 'origenFondos',
        header: 'Pagado con',
        cell: ({ row }) => (row.original.origenFondos ? ORIGEN_FONDOS_LABELS[row.original.origenFondos] : '—'),
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

// "acciones": botones en el mismo renglón que el buscador (ej. "+ Registrar gasto").
export function GastosTable({ gastos, acciones }: { gastos: Gasto[]; acciones?: ReactNode }) {
    return <DataTable columns={columns} data={gastos} searchPlaceholder="Buscar gasto..." acciones={acciones} />;
}
