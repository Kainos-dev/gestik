// src/features/pagos/components/pagos-table.tsx
'use client';

import { useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Pago } from '../types';
import { eliminarPago } from '../actions';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { METODO_PAGO_LABELS, TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function AccionEliminar({ pago }: { pago: Pago }) {
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar pago"
            disabled={isPending}
            onClick={() => {
                const confirmado = window.confirm(
                    `¿Eliminar el pago de ${formatCurrency(pago.monto, pago.moneda)} de ${pago.clienteNombre} (${formatDate(pago.fecha)})?\n\nLos cargos que este pago cubría van a volver a quedar pendientes/vencidos según corresponda.`,
                );
                if (!confirmado) return;

                startTransition(async () => {
                    try {
                        await eliminarPago(pago.id);
                        toast.success('Pago eliminado');
                    } catch (error) {
                        toast.error('Ocurrió un error al eliminar el pago');
                        console.error(error);
                    }
                });
            }}
        >
            <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
    );
}

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
        cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda),
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
    {
        id: 'acciones',
        header: '',
        cell: ({ row }) => <AccionEliminar pago={row.original} />,
    },
];

export function PagosTable({ pagos }: { pagos: Pago[] }) {
    return <DataTable columns={columns} data={pagos} searchPlaceholder="Buscar por cliente..." />;
}