// src/features/finanzas/components/historial-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Pago } from '@/features/pagos/types';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { METODO_PAGO_LABELS } from '@/lib/constants';
import { Download } from 'lucide-react';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function exportarCsv(pagos: Pago[]) {
    const encabezado = ['Fecha', 'Cliente', 'Monto', 'Método', 'Notas'];
    const filas = pagos.map((p) => [
        formatDate(p.fecha),
        p.clienteNombre ?? '',
        p.monto.toString(),
        METODO_PAGO_LABELS[p.metodoPago],
        (p.notas ?? '').replace(/[\n,]/g, ' '), // evita romper el CSV si hay comas o saltos de línea en las notas
    ]);

    const csv = [encabezado, ...filas].map((fila) => fila.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // el \uFEFF es para que Excel abra los acentos bien

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-pagos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

const columns: ColumnDef<Pago>[] = [
    { accessorKey: 'fecha', header: 'Fecha', cell: ({ row }) => formatDate(row.original.fecha) },
    { accessorKey: 'clienteNombre', header: 'Cliente' },
    { accessorKey: 'monto', header: 'Monto', cell: ({ row }) => formatCurrency(row.original.monto) },
    {
        accessorKey: 'metodoPago',
        header: 'Método',
        cell: ({ row }) => METODO_PAGO_LABELS[row.original.metodoPago],
    },
];

export function HistorialTable({ pagos }: { pagos: Pago[] }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportarCsv(pagos)}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                </Button>
            </div>
            <DataTable columns={columns} data={pagos} searchPlaceholder="Buscar en el historial..." />
        </div>
    );
}