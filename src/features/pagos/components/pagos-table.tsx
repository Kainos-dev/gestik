// src/features/pagos/components/pagos-table.tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Pago, PagoAnulado } from '../types';
import { restaurarPago } from '../actions';
import { EditarPagoDialog } from './editar-pago-dialog';
import { AnularPagoDialog } from './anular-pago-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { Button } from '@/components/ui/button';
import { Cliente } from '@/features/clients/types';
import { METODO_PAGO_LABELS, TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function CeldaCliente({ pago }: { pago: Pago }) {
    return (
        <div className="flex items-center gap-2">
            <ClienteColorDot color={pago.clienteColor} nombre={pago.clienteNombre} />
            {pago.clienteNombre}
        </div>
    );
}

// Lo acreditado al servicio y, si el cliente pagó en otra moneda, lo que
// realmente entró con la cotización con la que se registró.
function CeldaMonto({ pago }: { pago: Pago }) {
    const convertido = pago.monedaPago !== pago.moneda;
    return (
        <div>
            <div>{formatCurrency(pago.monto, pago.moneda)}</div>
            {convertido && (
                <div className="text-xs text-muted-foreground">
                    {formatCurrency(pago.montoPagado, pago.monedaPago)}
                    {pago.tipoCambio ? ` a ${formatCurrency(pago.tipoCambio, 'ARS')}` : ''}
                </div>
            )}
        </div>
    );
}

function nombreServicio(pago: Pago) {
    const tipo = pago.servicioNombre;
    if (!tipo) return '—';
    return TIPO_SERVICIO_LABELS[tipo] ?? tipo;
}

function columnas(clientes: Cliente[]): ColumnDef<Pago>[] {
    return [
        { accessorKey: 'fecha', header: 'Fecha', cell: ({ row }) => formatDate(row.original.fecha) },
        { accessorKey: 'clienteNombre', header: 'Cliente', cell: ({ row }) => <CeldaCliente pago={row.original} /> },
        { accessorKey: 'monto', header: 'Monto', cell: ({ row }) => <CeldaMonto pago={row.original} /> },
        { accessorKey: 'metodoPago', header: 'Método', cell: ({ row }) => METODO_PAGO_LABELS[row.original.metodoPago] },
        { accessorKey: 'servicioNombre', header: 'Servicio', cell: ({ row }) => nombreServicio(row.original) },
        {
            id: 'acciones',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <EditarPagoDialog pago={row.original} clientes={clientes} />
                    <AnularPagoDialog pago={row.original} />
                </div>
            ),
        },
    ];
}

export function PagosTable({ pagos, clientes }: { pagos: Pago[]; clientes: Cliente[] }) {
    return <DataTable columns={columnas(clientes)} data={pagos} buscador={false} />;
}

// ─── Anulados ───────────────────────────────────────────────────────────────

function AccionRestaurar({ anulado }: { anulado: PagoAnulado }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { pago } = anulado;

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
                const confirmado = window.confirm(
                    `¿Restaurar el cobro de ${formatCurrency(pago.montoPagado, pago.monedaPago)} de ${pago.clienteNombre} (${formatDate(pago.fecha)})?\n\nVuelve a contar en el saldo del servicio, la cuenta, Balance Mensual y Gestión, con sus datos y cotización originales.`
                );
                if (!confirmado) return;
                startTransition(async () => {
                    try {
                        const resultado = await restaurarPago(anulado.registroAnuladoId);
                        if (!resultado.ok) {
                            toast.error(resultado.error);
                            return;
                        }
                        toast.success('Cobro restaurado');
                        router.refresh();
                    } catch (error) {
                        toast.error('Ocurrió un error al restaurar el cobro');
                        console.error(error);
                    }
                });
            }}
        >
            <RotateCcw className="h-4 w-4" />
            {isPending ? 'Restaurando...' : 'Restaurar'}
        </Button>
    );
}

const columnasAnulados: ColumnDef<PagoAnulado>[] = [
    { id: 'fecha', header: 'Fecha del cobro', cell: ({ row }) => formatDate(row.original.pago.fecha) },
    { id: 'cliente', header: 'Cliente', cell: ({ row }) => <CeldaCliente pago={row.original.pago} /> },
    { id: 'monto', header: 'Monto', cell: ({ row }) => <CeldaMonto pago={row.original.pago} /> },
    { id: 'servicio', header: 'Servicio', cell: ({ row }) => nombreServicio(row.original.pago) },
    { id: 'anulado', header: 'Anulado el', cell: ({ row }) => formatDate(row.original.anuladoAt) },
    {
        id: 'motivo',
        header: 'Motivo',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.motivo}</span>,
    },
    { id: 'acciones', header: '', cell: ({ row }) => <AccionRestaurar anulado={row.original} /> },
];

export function PagosAnuladosTable({ anulados }: { anulados: PagoAnulado[] }) {
    return <DataTable columns={columnasAnulados} data={anulados} buscador={false} />;
}
