// src/features/deudas/components/deuda-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { DeudaSchema, DeudaInput } from '../schema';
import { crearDeuda, editarDeuda } from '../actions';
import { Deuda, Integrante } from '../types';

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
import { MONEDAS } from '@/lib/moneda';
import { DatePicker } from '@/components/shared/date-picker';

interface DeudaFormProps {
    deuda?: Deuda; // si viene, es edición
    integrantes: Integrante[];
    onSuccess?: () => void;
}

export function DeudaForm({ deuda, integrantes, onSuccess }: DeudaFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(deuda);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<DeudaInput>({
        resolver: zodResolver(DeudaSchema),
        defaultValues: {
            integranteId: deuda?.integranteId ?? '',
            descripcion: deuda?.descripcion ?? '',
            montoTotal: deuda?.montoTotal ?? 0,
            moneda: deuda?.moneda ?? 'ARS',
            fecha: deuda?.fecha ?? new Date(),
            notas: deuda?.notas ?? '',
        },
    });

    function onSubmit(data: DeudaInput) {
        startTransition(async () => {
            try {
                if (esEdicion && deuda) {
                    await editarDeuda(deuda.id, data);
                    toast.success('Deuda actualizada');
                } else {
                    await crearDeuda(data);
                    toast.success('Deuda registrada');
                }
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar la deuda');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="integranteId">Quién puso la plata *</Label>
                <Controller
                    name="integranteId"
                    control={control}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="integranteId">
                                {/* SelectValue no resuelve el label automáticamente a partir de
                                    los hijos de SelectItem (a diferencia de un <select> nativo) —
                                    acá hace falta el render-prop de Base UI porque el value es un
                                    id sin sentido para mostrar (a diferencia de enums como
                                    categoría, donde el value crudo ya es legible). */}
                                <SelectValue placeholder="Elegir integrante">
                                    {(value: string | null) =>
                                        integrantes.find((i) => i.id === value)?.nombre ?? 'Elegir integrante'
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {integrantes.map((integrante) => (
                                    <SelectItem key={integrante.id} value={integrante.id}>
                                        {integrante.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.integranteId && <p className="text-sm text-red-600">{errors.integranteId.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Input id="descripcion" placeholder="Ej: Set de iluminación" {...register('descripcion')} />
                {errors.descripcion && <p className="text-sm text-red-600">{errors.descripcion.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="montoTotal">Monto total *</Label>
                <div className="flex gap-2">
                    <Input id="montoTotal" type="number" step="0.01" className="flex-1" {...register('montoTotal')} />
                    <Controller
                        name="moneda"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="moneda" className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONEDAS.map((moneda) => (
                                        <SelectItem key={moneda} value={moneda}>
                                            {moneda}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                {errors.montoTotal && <p className="text-sm text-red-600">{errors.montoTotal.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha *</Label>
                <Controller
                    name="fecha"
                    control={control}
                    render={({ field }) => <DatePicker id="fecha" value={field.value as Date | undefined} onChange={field.onChange} />}
                />
                {errors.fecha && <p className="text-sm text-red-600">{errors.fecha.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" rows={3} {...register('notas')} />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar deuda'}
            </Button>
        </form>
    );
}
