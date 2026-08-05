// src/features/servicios/components/servicios-table.tsx
'use client';

import { useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Servicio } from '../types';
import { renovarServicio } from '../actions';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { TIPO_SERVICIO_LABELS, FRECUENCIA_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

function AccionRenovar({ servicio }: { servicio: Servicio }) {
  const [isPending, startTransition] = useTransition();

  // Un servicio único no vence, y uno pausado/finalizado no se renueva
  if (servicio.frecuencia === 'UNICO' || servicio.estado !== 'ACTIVO') return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await renovarServicio(servicio.id);
            toast.success('Servicio renovado, pago pendiente generado');
          } catch (error) {
            toast.error('Ocurrió un error al renovar el servicio');
            console.error(error);
          }
        })
      }
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
    cell: ({ row }) =>
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(row.original.precio),
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
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ row }) => <StatusBadge value={row.original.estado} />,
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