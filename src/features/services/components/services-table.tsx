// src/features/servicios/components/servicios-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Servicio } from '../types';
import { calcularEstadoRenovacion } from '../services';
import { RenovarServicioDialog } from './renovar-servicio-dialog';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { TIPO_SERVICIO_LABELS, FRECUENCIA_LABELS } from '@/lib/constants';
import { formatDate, formatDateLocal } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

const columns: ColumnDef<Servicio>[] = [
  { accessorKey: 'clienteNombre', header: 'Cliente' },
  {
    accessorKey: 'tipo',
    header: 'Servicio',
    cell: ({ row }) =>
      row.original.tipo === 'OTRO'
        ? row.original.nombrePersonalizado ?? 'Otro'
        : TIPO_SERVICIO_LABELS[row.original.tipo],
  },
  {
    accessorKey: 'precio',
    header: 'Precio',
    cell: ({ row }) => formatCurrency(row.original.precio, row.original.moneda),
  },
  {
    accessorKey: 'frecuencia',
    header: 'Frecuencia',
    cell: ({ row }) => FRECUENCIA_LABELS[row.original.frecuencia],
  },
  {
    accessorKey: 'proximoVencimiento',
    header: 'Próx. renovacion',
    cell: ({ row }) =>
      row.original.proximoVencimiento ? formatDate(row.original.proximoVencimiento) : '—',
  },
  {
    id: 'estadoPago',
    header: 'Estado de pago',
    cell: ({ row }) => {
      const estadoPago = calcularEstadoRenovacion(row.original.estado, row.original.proximoVencimiento);
      return estadoPago ? <StatusBadge value={estadoPago} /> : <span className="text-muted-foreground text-sm">—</span>;
    },
  },
  {
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ row }) => <StatusBadge value={row.original.estado} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Fecha de creación',
    cell: ({ row }) => formatDateLocal(row.original.createdAt),
  },
  {
    id: 'acciones',
    header: '',
    cell: ({ row }) => <RenovarServicioDialog servicio={row.original} />,
  },
];

export function ServiciosTable({ servicios }: { servicios: Servicio[] }) {
  return <DataTable columns={columns} data={servicios} searchPlaceholder="Buscar servicio o cliente..." />;
}