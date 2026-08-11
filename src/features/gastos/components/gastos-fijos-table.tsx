// src/features/gastos/components/gastos-fijos-table.tsx
'use client';

import { useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { GastoFijo } from '../types';
import { registrarGastoDelMes } from '../actions';
import { calcularEstadoPagoGastoFijo } from '../services';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { CATEGORIA_GASTO_LABELS, FRECUENCIA_LABELS } from '@/lib/constants';
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
        cell: ({ row }) => FRECUENCIA_LABELS[row.original.frecuencia],
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
        cell: ({ row }) => <AccionRegistrar gastoFijo={row.original} />,
    },
];

export function GastosFijosTable({ gastosFijos }: { gastosFijos: GastoFijo[] }) {
    return <DataTable columns={columns} data={gastosFijos} searchPlaceholder="Buscar gasto fijo..." />;
}
