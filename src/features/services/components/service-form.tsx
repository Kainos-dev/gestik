// src/features/servicios/components/servicio-form.tsx
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  ServicioSchema,
  ServicioInput,
  TIPOS_SERVICIO,
  FRECUENCIAS_SERVICIO,
  ESTADOS_SERVICIO,
} from "../schema";
import { crearServicio, editarServicio } from "../actions";
import { Servicio } from "../types";
import { Cliente } from "@/features/clientes/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIPO_SERVICIO_LABELS,
  FRECUENCIA_LABELS,
  ESTADO_STYLES,
} from "@/lib/constants";

interface ServicioFormProps {
  clientes: Cliente[]; // para poblar el selector
  servicio?: Servicio; // si viene, es edición
  clienteIdFijo?: string; // cuando se crea desde el detalle de un cliente puntual
  onSuccess?: () => void;
}

export function ServicioForm({
  clientes,
  servicio,
  clienteIdFijo,
  onSuccess,
}: ServicioFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const esEdicion = Boolean(servicio);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ServicioInput>({
    resolver: zodResolver(ServicioSchema),
    defaultValues: {
      clienteId: servicio?.clienteId ?? clienteIdFijo ?? "",
      tipo: servicio?.tipo ?? "DESARROLLO_WEB",
      nombrePersonalizado: servicio?.nombrePersonalizado ?? "",
      precio: servicio?.precio ?? 0,
      frecuencia: servicio?.frecuencia ?? "MENSUAL",
      fechaInicio: servicio?.fechaInicio ?? new Date(),
      estado: servicio?.estado,
    },
  });

  const tipoSeleccionado = watch("tipo");

  function onSubmit(data: ServicioInput) {
    startTransition(async () => {
      try {
        if (esEdicion && servicio) {
          await editarServicio(servicio.id, data);
          toast.success("Servicio actualizado");
        } else {
          await crearServicio(data);
          toast.success("Servicio creado");
        }
        router.refresh();
        onSuccess?.();
      } catch (error) {
        toast.error("Ocurrió un error al guardar el servicio");
        console.error(error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!clienteIdFijo && (
        <div className="space-y-1.5">
          <Label htmlFor="clienteId">Cliente *</Label>
          <Controller
            name="clienteId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={esEdicion}
              >
                <SelectTrigger id="clienteId">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.clienteId && (
            <p className="text-sm text-red-600">{errors.clienteId.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo de servicio *</Label>
          <Controller
            name="tipo"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICIO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {TIPO_SERVICIO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="frecuencia">Frecuencia *</Label>
          <Controller
            name="frecuencia"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="frecuencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRECUENCIAS_SERVICIO.map((frecuencia) => (
                    <SelectItem key={frecuencia} value={frecuencia}>
                      {FRECUENCIA_LABELS[frecuencia]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {tipoSeleccionado === "OTRO" && (
        <div className="space-y-1.5">
          <Label htmlFor="nombrePersonalizado">Especificar *</Label>
          <Input
            id="nombrePersonalizado"
            {...register("nombrePersonalizado")}
          />
          {errors.nombrePersonalizado && (
            <p className="text-sm text-red-600">
              {errors.nombrePersonalizado.message}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="precio">Precio *</Label>
          <Input
            id="precio"
            type="number"
            step="0.01"
            {...register("precio")}
          />
          {errors.precio && (
            <p className="text-sm text-red-600">{errors.precio.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
          <Input
            id="fechaInicio"
            type="date"
            {...register("fechaInicio")}
            defaultValue={
              servicio?.fechaInicio
                ? new Date(servicio.fechaInicio).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0]
            }
          />
          {errors.fechaInicio && (
            <p className="text-sm text-red-600">{errors.fechaInicio.message}</p>
          )}
        </div>
      </div>

      {esEdicion && (
        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Controller
            name="estado"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="estado">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_SERVICIO.map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {ESTADO_STYLES[estado]?.label ?? estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? "Guardando..."
          : esEdicion
            ? "Guardar cambios"
            : "Crear servicio"}
      </Button>
    </form>
  );
}
