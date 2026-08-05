// src/features/pagos/components/pago-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { PagoSchema, PagoInput, METODOS_PAGO, ESTADOS_PAGO_GUARDADO } from '../schema';
import { crearPago, editarPago } from '../actions';
import { Pago } from '../types';
import { Cliente } from '@/features/clients/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { METODO_PAGO_LABELS, ESTADO_STYLES, TIPO_SERVICIO_LABELS } from '@/lib/constants';

interface ServicioOption {
    id: string;
    tipo: string;
    nombre_personalizado: string | null;
}

interface PagoFormProps {
    clientes: Cliente[];
    pago?: Pago;
    clienteIdFijo?: string; // cuando se registra desde el detalle de un cliente
    onSuccess?: () => void;
}

export function PagoForm({ clientes, pago, clienteIdFijo, onSuccess }: PagoFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(pago);
    const [servicios, setServicios] = useState<ServicioOption[]>([]);

    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors },
    } = useForm<PagoInput>({
        resolver: zodResolver(PagoSchema),
        defaultValues: {
            clienteId: pago?.clienteId ?? clienteIdFijo ?? '',
            servicioId: pago?.servicioId ?? '',
            fecha: pago?.fecha ?? new Date(),
            monto: pago?.monto ?? 0,
            metodoPago: pago?.metodoPago ?? 'TRANSFERENCIA',
            estado: pago?.estado ?? 'PENDIENTE',
            comprobanteUrl: pago?.comprobanteUrl ?? '',
            notas: pago?.notas ?? '',
        },
    });

    const clienteSeleccionado = watch('clienteId');

    // Cuando cambia el cliente, recarga la lista de servicios disponibles para asociar
    useEffect(() => {
        if (!clienteSeleccionado) {
            setServicios([]);
            return;
        }
        fetch(`/api/servicios/por-cliente?clienteId=${clienteSeleccionado}`)
            .then((res) => res.json())
            .then(setServicios)
            .catch(() => setServicios([]));
    }, [clienteSeleccionado]);

    function onSubmit(data: PagoInput) {
        startTransition(async () => {
            try {
                if (esEdicion && pago) {
                    await editarPago(pago.id, data);
                    toast.success('Pago actualizado');
                } else {
                    await crearPago(data);
                    toast.success('Pago registrado');
                }
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el pago');
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
                            <Select value={field.value} onValueChange={field.onChange} disabled={esEdicion}>
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
                    {errors.clienteId && <p className="text-sm text-red-600">{errors.clienteId.message}</p>}
                </div>
            )}

            <div className="space-y-1.5">
                <Label htmlFor="servicioId">Servicio (opcional)</Label>
                <Controller
                    name="servicioId"
                    control={control}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!clienteSeleccionado}>
                            <SelectTrigger id="servicioId">
                                <SelectValue placeholder="Sin asociar a un servicio puntual" />
                            </SelectTrigger>
                            <SelectContent>
                                {servicios.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.tipo === 'OTRO' ? s.nombre_personalizado : TIPO_SERVICIO_LABELS[s.tipo]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="monto">Monto *</Label>
                    <Input id="monto" type="number" step="0.01" {...register('monto')} />
                    {errors.monto && <p className="text-sm text-red-600">{errors.monto.message}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <Input
                        id="fecha"
                        type="date"
                        {...register('fecha')}
                        defaultValue={
                            pago?.fecha ? new Date(pago.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                        }
                    />
                    {errors.fecha && <p className="text-sm text-red-600">{errors.fecha.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="metodoPago">Método de pago *</Label>
                    <Controller
                        name="metodoPago"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="metodoPago">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {METODOS_PAGO.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {METODO_PAGO_LABELS[m]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="estado">Estado *</Label>
                    <Controller
                        name="estado"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="estado">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ESTADOS_PAGO_GUARDADO.map((estado) => (
                                        <SelectItem key={estado} value={estado}>
                                            {ESTADO_STYLES[estado]?.label ?? estado}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="comprobanteUrl">Comprobante (URL)</Label>
                <Input id="comprobanteUrl" placeholder="https://..." {...register('comprobanteUrl')} />
                {errors.comprobanteUrl && <p className="text-sm text-red-600">{errors.comprobanteUrl.message}</p>}
                <p className="text-xs text-muted-foreground">
                    Por ahora pegá el link manualmente. La subida de archivos se conecta cuando armemos el storage.
                </p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" rows={3} {...register('notas')} />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar pago'}
            </Button>
        </form>
    );
}