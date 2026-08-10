// src/features/gastos/components/gasto-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { GastoSchema, GastoInput, CATEGORIAS_GASTO } from '../schema';
import { crearGasto, editarGasto } from '../actions';
import { Gasto, GastoFijo } from '../types';

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
import { CATEGORIA_GASTO_LABELS } from '@/lib/constants';
import { MONEDAS } from '@/lib/moneda';

interface GastoFormProps {
    gastosFijos: GastoFijo[]; // para asociar (opcional) el gasto a un gasto fijo existente
    gasto?: Gasto; // si viene, es edición
    onSuccess?: () => void;
}

export function GastoForm({ gastosFijos, gasto, onSuccess }: GastoFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(gasto);

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm<GastoInput>({
        resolver: zodResolver(GastoSchema),
        defaultValues: {
            gastoFijoId: gasto?.gastoFijoId ?? '',
            categoria: gasto?.categoria ?? 'OTRO',
            descripcion: gasto?.descripcion ?? '',
            monto: gasto?.monto ?? 0,
            moneda: gasto?.moneda ?? 'ARS',
            fecha: gasto?.fecha ?? new Date(),
            notas: gasto?.notas ?? '',
        },
    });

    const gastoFijoSeleccionado = watch('gastoFijoId');
    const gastoFijoElegido = gastosFijos.find((g) => g.id === gastoFijoSeleccionado);

    // Al elegir un gasto fijo, precarga categoría/descripción/monto/moneda
    // (categoría, descripción y monto se pueden ajustar después; la moneda
    // no, porque el gasto tiene que quedar en la misma moneda que el fijo)
    useEffect(() => {
        if (!gastoFijoElegido) return;
        setValue('categoria', gastoFijoElegido.categoria);
        setValue('descripcion', gastoFijoElegido.nombre);
        setValue('monto', gastoFijoElegido.monto);
        setValue('moneda', gastoFijoElegido.moneda);
    }, [gastoFijoElegido, setValue]);

    function onSubmit(data: GastoInput) {
        startTransition(async () => {
            try {
                if (esEdicion && gasto) {
                    await editarGasto(gasto.id, data);
                    toast.success('Gasto actualizado');
                } else {
                    await crearGasto(data);
                    toast.success('Gasto registrado');
                }
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el gasto');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="gastoFijoId">Gasto fijo (opcional)</Label>
                <Controller
                    name="gastoFijoId"
                    control={control}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="gastoFijoId">
                                <SelectValue placeholder="Gasto puntual, sin asociar" />
                            </SelectTrigger>
                            <SelectContent>
                                {gastosFijos.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                        {g.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Controller
                        name="categoria"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="categoria">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS_GASTO.map((categoria) => (
                                        <SelectItem key={categoria} value={categoria}>
                                            {CATEGORIA_GASTO_LABELS[categoria]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="monto">Monto *</Label>
                    <div className="flex gap-2">
                        <Input id="monto" type="number" step="0.01" className="flex-1" {...register('monto')} />
                        <Controller
                            name="moneda"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={Boolean(gastoFijoElegido)}
                                >
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
                    {errors.monto && <p className="text-sm text-red-600">{errors.monto.message}</p>}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Input id="descripcion" placeholder="Ej: Notebook nueva" {...register('descripcion')} />
                {errors.descripcion && <p className="text-sm text-red-600">{errors.descripcion.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                    id="fecha"
                    type="date"
                    {...register('fecha')}
                    defaultValue={
                        gasto?.fecha ? new Date(gasto.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                    }
                />
                {errors.fecha && <p className="text-sm text-red-600">{errors.fecha.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" rows={3} {...register('notas')} />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
        </form>
    );
}
