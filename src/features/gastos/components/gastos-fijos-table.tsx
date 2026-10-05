// src/features/gastos/components/gastos-fijos-table.tsx
'use client';

import { useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { GastoFijo } from '../types';
import { registrarGastoDelMes, eliminarGastoFijo } from '../actions';
import { calcularEstadoPagoGastoFijo } from '../services';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EditarGastoFijoDialog } from './edit-gasto-fijo-dialog';
import { Button } from '@/components/ui/button';
import { CATEGORIA_GASTO_LABELS, FRECUENCIA_GASTO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function AccionRegistrar({ gastoFijo }: { gastoFijo: GastoFijo }) {
    const [isPending, startTransition] = useTransition();

    if (gastoFijo.estado !== 'ACTIVO') return null;

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
                const periodo = gastoFijo.proximoVencimiento ? formatDate(gastoFijo.proximoVencimiento) : 'este período';
                const confirmado = window.confirm(
                    `¿Registrar "${gastoFijo.nombre}" (${periodo})?\n\nSe va a generar un nuevo gasto y el próximo vencimiento va a avanzar al siguiente período.`,
                );
                if (!confirmado) return;

                startTransition(async () => {
                    try {
                        await registrarGastoDelMes(gastoFijo.id);
                        toast.success('Gasto del período registrado');
                    } catch (error) {
                        toast.error('Ocurrió un error al registrar el gasto');
                        console.error(error);
                    }
                });
            }}
        >
            Registrar del mes
        </Button>
    );
}

function AccionEliminar({ gastoFijo }: { gastoFijo: GastoFijo }) {
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar gasto fijo"
            disabled={isPending}
            onClick={() => {
                const confirmado = window.confirm(
                    `¿Eliminar "${gastoFijo.nombre}" de Gastos Fijos?\n\nNo se va a volver a generar automáticamente. Los gastos que ya se registraron a partir de él NO se borran: quedan como gastos sueltos en "Registro de Gastos".`,
                );
                if (!confirmado) return;

                startTransition(async () => {
                    try {
                        await eliminarGastoFijo(gastoFijo.id);
                        toast.success('Gasto fijo eliminado');
                    } catch (error) {
                        toast.error('Ocurrió un error al eliminar el gasto fijo');
                        console.error(error);
                    }
                });
            }}
        >
            <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
    );
}

const columns: ColumnDef<GastoFijo>[] = [
    { accessorKey: 'nombre', header: 'Nombre' },
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
        accessorKey: 'frecuencia',
        header: 'Frecuencia',
        cell: ({ row }) => FRECUENCIA_GASTO_LABELS[row.original.frecuencia],
    },
    {
        accessorKey: 'proximoVencimiento',
        header: 'Próx. vencimiento',
        cell: ({ row }) =>
            row.original.proximoVencimiento ? formatDate(row.original.proximoVencimiento) : '—',
    },
    {
        id: 'estadoPago',
        header: 'Estado de pago',
        cell: ({ row }) => {
            const estadoPago = calcularEstadoPagoGastoFijo(row.original.estado, row.original.proximoVencimiento);
            return estadoPago ? <StatusBadge value={estadoPago} /> : <span className="text-muted-foreground text-sm">—</span>;
        },
    },
    {
        accessorKey: 'estado',
        header: 'Estado',
        cell: ({ row }) => <StatusBadge value={row.original.estado} />,
    },
    {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1">
                <EditarGastoFijoDialog gastoFijo={row.original} />
                <AccionRegistrar gastoFijo={row.original} />
                <AccionEliminar gastoFijo={row.original} />
            </div>
        ),
    },
];

export function GastosFijosTable({ gastosFijos }: { gastosFijos: GastoFijo[] }) {
    return <DataTable columns={columns} data={gastosFijos} searchPlaceholder="Buscar gasto fijo..." />;
}
