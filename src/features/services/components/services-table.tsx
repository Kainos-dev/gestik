// src/features/servicios/components/servicios-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Servicio } from '../types';
import { calcularEstadoRenovacion } from '../services';
import { RenovarServicioDialog } from './renovar-servicio-dialog';
import { EditarServicioDialog } from './edit-service-dialog';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { TIPO_SERVICIO_LABELS, FRECUENCIA_LABELS } from '@/lib/constants';
import { formatDate, formatDateLocal } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';
import { Cliente } from '@/features/clients/types';

function construirColumnas(clientes: Cliente[]): ColumnDef<Servicio>[] {
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
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <EditarServicioDialog servicio={row.original} clientes={clientes} />
          <RenovarServicioDialog servicio={row.original} />
        </div>
      ),
    },
  ];
}

export function ServiciosTable({ servicios, clientes }: { servicios: Servicio[]; clientes: Cliente[] }) {
  return (
    <DataTable
      columns={construirColumnas(clientes)}
      data={servicios}
      searchPlaceholder="Buscar servicio o cliente..."
    />
  );
}
