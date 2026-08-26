// src/features/deudas/components/deudas-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Deuda, Integrante } from '../types';
import { calcularEstadoDeuda } from '../services';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Progress } from '@/components/ui/progress';
import { EditarDeudaDialog } from './edit-deuda-dialog';
import { ReponerDeudaDialog } from './reponer-deuda-dialog';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function Progreso({ deuda }: { deuda: Deuda }) {
    const pct = deuda.montoTotal > 0 ? (deuda.montoRepuesto / deuda.montoTotal) * 100 : 0;

    return (
        <div className="min-w-40 space-y-1">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">
                {formatCurrency(deuda.montoRepuesto, deuda.moneda)} / {formatCurrency(deuda.montoTotal, deuda.moneda)}
            </p>
        </div>
    );
}

function columnas(integrantes: Integrante[]): ColumnDef<Deuda>[] {
    return [
        { accessorKey: 'descripcion', header: 'Descripción' },
        { accessorKey: 'integranteNombre', header: 'Integrante' },
        {
            id: 'progreso',
            header: 'Progreso',
            cell: ({ row }) => <Progreso deuda={row.original} />,
        },
        {
            id: 'estado',
            header: 'Estado',
            cell: ({ row }) => (
                <StatusBadge value={calcularEstadoDeuda(row.original.montoTotal, row.original.montoRepuesto)} />
            ),
        },
        {
            accessorKey: 'fecha',
            header: 'Fecha',
            cell: ({ row }) => formatDate(row.original.fecha),
        },
        {
            id: 'acciones',
            header: '',
            cell: ({ row }) => {
                const estado = calcularEstadoDeuda(row.original.montoTotal, row.original.montoRepuesto);
                return (
                    <div className="flex items-center justify-end gap-1">
                        <EditarDeudaDialog deuda={row.original} integrantes={integrantes} />
                        {estado !== 'SALDADA' && <ReponerDeudaDialog deuda={row.original} />}
                    </div>
                );
            },
        },
    ];
}

export function DeudasTable({ deudas, integrantes }: { deudas: Deuda[]; integrantes: Integrante[] }) {
    return <DataTable columns={columnas(integrantes)} data={deudas} searchPlaceholder="Buscar deuda..." />;
}
