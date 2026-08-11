// src/features/clients/components/clients-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Cliente } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/utils';

const columns: ColumnDef<Cliente>[] = [
    { accessorKey: 'nombre', header: 'Nombre' },
    { accessorKey: 'empresa', header: 'Empresa' },
    {
        accessorKey: 'whatsapp',
        header: 'Celular',
        cell: ({ row }) => row.original.whatsapp ?? '—',
    },
    {
        accessorKey: 'estado',
        header: 'Estado',
        cell: ({ row }) => <StatusBadge value={row.original.estado} />,
    },
    {
        accessorKey: 'fechaAlta',
        header: 'Alta',
        cell: ({ row }) => formatDate(row.original.fechaAlta),
    },
];

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
    return <DataTable columns={columns} data={clientes} searchPlaceholder="Buscar cliente..." />;
}