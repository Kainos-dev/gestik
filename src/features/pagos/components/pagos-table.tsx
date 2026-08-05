// src/features/pagos/components/pagos-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Pago } from '../types';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { METODO_PAGO_LABELS } from '@/lib/constants';
import { calcularEstadoMostrado } from '../services';
import { Button } from '@/components/ui/button';
import { marcarComoPagado } from '../actions';
import { toast } from 'sonner';
import { useTransition } from 'react';
import { formatDate } from '@/lib/utils';


function AccionMarcarPagado({ pago }: { pago: Pago }) {
    const [isPending, startTransition] = useTransition();
    if (pago.estado === 'PAGADO') return null;

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
                startTransition(async () => {
                    await marcarComoPagado(pago.id, pago.clienteId);
                    toast.success('Pago marcado como pagado');
                })
            }
        >
            Marcar pagado
        </Button>
    );
}

const columns: ColumnDef<Pago>[] = [
    {
        accessorKey: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => formatDate(row.original.fecha), // antes: new Date(...).toLocaleDateString('es-AR')
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
        id: 'estadoMostrado',
        header: 'Estado',
        cell: ({ row }) => (
            <StatusBadge value={calcularEstadoMostrado(row.original.estado, row.original.fecha)} />
        ),
    },
    {
        id: 'acciones',
        header: '',
        cell: ({ row }) => <AccionMarcarPagado pago={row.original} />,
    },
];

export function PagosTable({ pagos }: { pagos: Pago[] }) {
    return <DataTable columns={columns} data={pagos} searchPlaceholder="Buscar por cliente..." />;
}