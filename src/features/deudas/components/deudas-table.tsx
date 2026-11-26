// src/features/deudas/components/deudas-table.tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { RotateCcw } from 'lucide-react';
import { Deuda, Integrante, ReposicionDeuda } from '../types';
import { calcularEstadoDeuda } from '../services';
import { restaurarDeuda } from '../actions';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EditarDeudaDialog } from './edit-deuda-dialog';
import { ReponerDeudaDialog } from './reponer-deuda-dialog';
import { HistorialDeudaDialog } from './historial-deuda-dialog';
import { EliminarDeudaDialog } from './eliminar-deuda-dialog';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function Progreso({ deuda }: { deuda: Deuda }) {
    if (deuda.deudaReemplazoId) {
        return (
            <div className="min-w-40 space-y-1 text-xs">
                <p>Pagado en ARS {formatCurrency(deuda.montoRepuesto, deuda.moneda)}</p>
                <p className="text-muted-foreground">
                    Convertido a USD {formatCurrency(deuda.montoTotal - deuda.montoRepuesto, deuda.moneda)}
                </p>
            </div>
        );
    }
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

function RestaurarDeudaButton({ deuda }: { deuda: Deuda }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
                startTransition(async () => {
                    try {
                        const resultado = await restaurarDeuda(deuda.id);
                        if (!resultado.ok) {
                            toast.error(resultado.error);
                            return;
                        }
                        toast.success('Deuda restaurada');
                        router.refresh();
                    } catch (error) {
                        toast.error('Ocurrió un error al restaurar la deuda');
                        console.error(error);
                    }
                })
            }
        >
            <RotateCcw className="h-4 w-4" />
            Restaurar
        </Button>
    );
}

function columnas(integrantes: Integrante[], reposicionesPorDeuda: Record<string, ReposicionDeuda[]>): ColumnDef<Deuda>[] {
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
            cell: ({ row }) => row.original.deudaReemplazoId ? 'Archivada por conversión' : (
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
                const deuda = row.original;
                const reposiciones = reposicionesPorDeuda[deuda.id] ?? [];

                if (deuda.eliminadaAt) {
                    return (
                        <div className="flex items-center justify-end gap-1">
                            <HistorialDeudaDialog deuda={deuda} reposiciones={reposiciones} />
                            {!deuda.deudaReemplazoId && <RestaurarDeudaButton deuda={deuda} />}
                        </div>
                    );
                }

                const estado = calcularEstadoDeuda(deuda.montoTotal, deuda.montoRepuesto);
                return (
                    <div className="flex items-center justify-end gap-1">
                        <HistorialDeudaDialog deuda={deuda} reposiciones={reposiciones} />
                        <EditarDeudaDialog deuda={deuda} integrantes={integrantes} />
                        <EliminarDeudaDialog deuda={deuda} cantidadReposiciones={reposiciones.length} />
                        {estado !== 'SALDADA' && <ReponerDeudaDialog deuda={deuda} />}
                    </div>
                );
            },
        },
    ];
}

export function DeudasTable({
    deudas,
    integrantes,
    reposicionesPorDeuda,
    busqueda,
}: {
    deudas: Deuda[];
    integrantes: Integrante[];
    reposicionesPorDeuda: Record<string, ReposicionDeuda[]>;
    busqueda?: string; // el buscador vive en DeudasPanel (mismo filtro que el buscador propio de la tabla)
}) {
    return (
        <DataTable
            columns={columnas(integrantes, reposicionesPorDeuda)}
            data={deudas}
            searchPlaceholder="Buscar deuda..."
            busqueda={busqueda}
        />
    );
}
