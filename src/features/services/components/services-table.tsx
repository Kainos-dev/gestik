// src/features/servicios/components/servicios-table.tsx
'use client';

import { useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Servicio } from '../types';
import { renovarServicio } from '../actions';
import { calcularEstadoRenovacion } from '../services';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { TIPO_SERVICIO_LABELS, FRECUENCIA_LABELS } from '@/lib/constants';
import { formatDate, formatDateLocal } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

function nombreServicio(servicio: Servicio) {
  return servicio.tipo === 'OTRO' ? servicio.nombrePersonalizado ?? 'Otro' : TIPO_SERVICIO_LABELS[servicio.tipo];
}

function AccionRenovar({ servicio }: { servicio: Servicio }) {
  const [isPending, startTransition] = useTransition();

  // Un servicio único no vence, y uno pausado/finalizado no se renueva
  if (servicio.frecuencia === 'UNICO' || servicio.estado !== 'ACTIVO') return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        const confirmado = window.confirm(
          `¿Renovar "${nombreServicio(servicio)}" de ${servicio.clienteNombre}?\n\nSe va a generar un nuevo cargo y el próximo vencimiento va a avanzar al siguiente período.`,
        );
        if (!confirmado) return;

        startTransition(async () => {
          try {
            await renovarServicio(servicio.id);
            toast.success('Servicio renovado, cargo generado');
          } catch (error) {
            toast.error('Ocurrió un error al renovar el servicio');
            console.error(error);
          }
        });
      }}
    >
      Renovar
    </Button>
  );
}

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
    cell: ({ row }) => <AccionRenovar servicio={row.original} />,
  },
];

export function ServiciosTable({ servicios }: { servicios: Servicio[] }) {
  return <DataTable columns={columns} data={servicios} searchPlaceholder="Buscar servicio o cliente..." />;
}