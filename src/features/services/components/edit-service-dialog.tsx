// src/features/servicios/components/editar-servicio-dialog.tsx
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ServicioForm } from "./servicio-form";
import { Servicio } from "../types";
import { Cliente } from "@/features/clientes/types";

export function EditarServicioDialog({
  servicio,
  clientes,
}: {
  servicio: Servicio;
  clientes: Cliente[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Editar servicio">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar servicio</DialogTitle>
        </DialogHeader>
        <ServicioForm
          servicio={servicio}
          clientes={clientes}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
