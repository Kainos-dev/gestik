// src/features/cargos/components/cargos-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Cargo } from '../types';
import { calcularEstadoCargo } from '../services';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';
import { Cliente } from '@/features/clients/types';
import { RegistrarPagoCargoButton } from './registrar-pago-cargo-button';

function nombreServicio(cargo: Cargo) {
    if (cargo.servicioTipo === 'OTRO') return cargo.servicioNombrePersonalizado ?? 'Otro';
    return TIPO_SERVICIO_LABELS[cargo.servicioTipo ?? ''] ?? cargo.servicioTipo ?? '—';
}

// El monto sugerido para "Registrar pago" es el total pendiente de TODO el
// servicio (no solo el resto de este cargo puntual): el pago se aplica
// oldest-first contra los cargos del servicio sin importar desde qué fila se
// dispare, así que sugerir solo el resto de esta fila subestimaría lo que
// realmente falta cobrar en cuanto haya más de un cargo pendiente.
function totalPendientePorServicio(cargos: Cargo[]): Map<string, number> {
    const mapa = new Map<string, number>();
    for (const c of cargos) {
        const pendiente = c.monto - c.montoCubierto;
        if (pendiente <= 0) continue;
        mapa.set(c.servicioId, (mapa.get(c.servicioId) ?? 0) + pendiente);
    }
    return mapa;
}

function columnas(clientes: Cliente[], pendientesPorServicio: Map<string, number>): ColumnDef<Cargo>[] {
    return [
        {
            accessorKey: 'clienteNombre',
            header: 'Cliente',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <ClienteColorDot color={row.original.clienteColor} nombre={row.original.clienteNombre} />
                    {row.original.clienteNombre}
                </div>
            ),
        },
        { id: 'servicio', header: 'Servicio', cell: ({ row }) => nombreServicio(row.original) },
        {
            accessorKey: 'periodo',
            header: 'Período',
            cell: ({ row }) => formatDate(row.original.periodo),
        },
        {
            accessorKey: 'vencimiento',
            header: 'Vencimiento',
            cell: ({ row }) => formatDate(row.original.vencimiento),
        },
        {
            accessorKey: 'monto',
            header: 'Monto',
            cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda),
        },
        {
            id: 'cubierto',
            header: 'Cubierto',
            cell: ({ row }) => formatCurrency(row.original.montoCubierto, row.original.moneda),
        },
        {
            id: 'estado',
            header: 'Estado',
            cell: ({ row }) => (
                <StatusBadge
                    value={calcularEstadoCargo(row.original.monto, row.original.montoCubierto, row.original.vencimiento)}
                />
            ),
        },
        {
            id: 'acciones',
            header: '',
            cell: ({ row }) => {
                // El botón solo aparece si ESTA fila tiene saldo propio (no
                // tiene sentido invitar a pagar un cargo ya cubierto), pero
                // el monto sugerido sigue siendo el total pendiente del
                // servicio (ver comentario de totalPendientePorServicio).
                const pendienteFila = row.original.monto - row.original.montoCubierto;
                if (pendienteFila <= 0) return null;
                const pendienteServicio = pendientesPorServicio.get(row.original.servicioId) ?? 0;
                return (
                    <RegistrarPagoCargoButton
                        clienteId={row.original.clienteId}
                        servicioId={row.original.servicioId}
                        montoSugerido={pendienteServicio}
                        clientes={clientes}
                    />
                );
            },
        },
    ];
}

export function CargosTable({ cargos, clientes }: { cargos: Cargo[]; clientes: Cliente[] }) {
    const pendientesPorServicio = totalPendientePorServicio(cargos);
    return (
        <DataTable columns={columnas(clientes, pendientesPorServicio)} data={cargos} searchPlaceholder="Buscar cargo..." />
    );
}
