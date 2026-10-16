// src/features/gastos/components/gasto-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { GastoSchema, GastoInput, CATEGORIAS_GASTO, ORIGENES_FONDOS } from '../schema';
import { crearGasto, editarGasto } from '../actions';
import { Gasto } from '../types';

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
import { CATEGORIA_GASTO_LABELS, ORIGEN_FONDOS_LABELS } from '@/lib/constants';
import { MONEDAS } from '@/lib/moneda';
import { DatePicker } from '@/components/shared/date-picker';

interface GastoFormProps {
    gasto?: Gasto; // si viene, es edición
    onSuccess?: () => void;
}

export function GastoForm({ gasto, onSuccess }: GastoFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(gasto);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<GastoInput>({
        resolver: zodResolver(GastoSchema),
        defaultValues: {
            // Se conserva el vínculo al editar un gasto generado por un gasto
            // fijo — el form no tiene campo para esto, y sin mandarlo
            // editarGasto lo pisaba con NULL (lo convertía en gasto suelto).
            gastoFijoId: gasto?.gastoFijoId ?? undefined,
            // Sin valor por defecto a propósito: hay que elegirlo sí o sí.
            origenFondos: gasto?.origenFondos ?? undefined,
            categoria: gasto?.categoria ?? 'OTRO',
            descripcion: gasto?.descripcion ?? '',
            monto: gasto?.monto ?? 0,
            moneda: gasto?.moneda ?? 'ARS',
            fecha: gasto?.fecha ?? new Date(),
            notas: gasto?.notas ?? '',
        },
    });

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Controller
                        name="categoria"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="categoria">
                                    <SelectValue>{(value: string) => CATEGORIA_GASTO_LABELS[value] ?? value}</SelectValue>
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
                    {errors.monto && <p className="text-sm text-red-600">{errors.monto.message}</p>}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="origenFondos">¿De dónde sale la plata? *</Label>
                <Controller
                    name="origenFondos"
                    control={control}
                    render={({ field }) => (
                        <Select value={field.value ?? null} onValueChange={field.onChange}>
                            <SelectTrigger id="origenFondos" className="w-full">
                                <SelectValue placeholder="Elegir cuenta o caja de ahorro">
                                    {(value: string | null) =>
                                        (value && ORIGEN_FONDOS_LABELS[value]) ?? 'Elegir cuenta o caja de ahorro'
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {ORIGENES_FONDOS.map((origen) => (
                                    <SelectItem key={origen} value={origen}>
                                        {ORIGEN_FONDOS_LABELS[origen]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.origenFondos && <p className="text-sm text-red-600">{errors.origenFondos.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Input id="descripcion" placeholder="Ej: Notebook nueva" {...register('descripcion')} />
                {errors.descripcion && <p className="text-sm text-red-600">{errors.descripcion.message}</p>}
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
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
        </form>
    );
}
