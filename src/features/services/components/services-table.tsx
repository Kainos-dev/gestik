// src/features/servicios/components/servicios-table.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Servicio } from "../types";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { TIPO_SERVICIO_LABELS, FRECUENCIA_LABELS } from "@/lib/constants";

const columns: ColumnDef<Servicio>[] = [
  { accessorKey: "clienteNombre", header: "Cliente" },
  {
    accessorKey: "tipo",
    header: "Servicio",
    cell: ({ row }) =>
      row.original.tipo === "OTRO"
        ? (row.original.nombrePersonalizado ?? "Otro")
        : TIPO_SERVICIO_LABELS[row.original.tipo],
  },
  {
    accessorKey: "precio",
    header: "Precio",
    cell: ({ row }) =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(row.original.precio),
  },
  {
    accessorKey: "frecuencia",
    header: "Frecuencia",
    cell: ({ row }) => FRECUENCIA_LABELS[row.original.frecuencia],
  },
  {
    accessorKey: "proximoVencimiento",
    header: "Próx. vencimiento",
    cell: ({ row }) =>
      row.original.proximoVencimiento
        ? new Date(row.original.proximoVencimiento).toLocaleDateString("es-AR")
        : "—",
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ row }) => <StatusBadge value={row.original.estado} />,
  },
];

export function ServiciosTable({ servicios }: { servicios: Servicio[] }) {
  return (
    <DataTable
      columns={columns}
      data={servicios}
      searchPlaceholder="Buscar servicio o cliente..."
    />
  );
}
