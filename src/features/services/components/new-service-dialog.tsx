// src/features/servicios/components/nuevo-servicio-dialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ServicioForm } from "./service-form";
import { Cliente } from "@/features/clients/types";

export function NuevoServicioDialog({
  clientes,
  clienteIdFijo,
}: {
  clientes: Cliente[];
  clienteIdFijo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Nuevo servicio</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
        </DialogHeader>
        <ServicioForm
          clientes={clientes}
          clienteIdFijo={clienteIdFijo}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
