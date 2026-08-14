// src/features/clients/components/clients-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Cliente } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { EditarClienteDialog } from './editar-cliente-dialog';
import { formatDate } from '@/lib/utils';

const columns: ColumnDef<Cliente>[] = [
    {
        accessorKey: 'nombre',
        header: 'Nombre',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <ClienteColorDot color={row.original.color} nombre={row.original.nombre} />
                {row.original.nombre}
            </div>
        ),
    },
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
    {
        id: 'acciones',
        header: '',
        cell: ({ row }) => <EditarClienteDialog cliente={row.original} />,
    },
];

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
    return <DataTable columns={columns} data={clientes} searchPlaceholder="Buscar cliente..." />;
}