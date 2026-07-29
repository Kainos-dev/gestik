// src/features/clients/components/clients-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Cliente } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

const columns: ColumnDef<Cliente>[] = [
    { accessorKey: 'nombre', header: 'Nombre' },
    { accessorKey: 'empresa', header: 'Empresa' },
    {
        accessorKey: 'estado',
        header: 'Estado',
        cell: ({ row }) => <StatusBadge value={row.original.estado} />,
    },
    {
        accessorKey: 'fechaAlta',
        header: 'Alta',
        cell: ({ row }) => new Date(row.original.fechaAlta).toLocaleDateString('es-AR'),
    },
];

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
    return <DataTable columns={columns} data={clientes} searchPlaceholder="Buscar cliente..." />;
}