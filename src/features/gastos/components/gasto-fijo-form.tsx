// src/features/gastos/components/gasto-fijo-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
    GastoFijoSchema,
    GastoFijoInput,
    CATEGORIAS_GASTO,
    FRECUENCIAS_GASTO,
    ESTADOS_GASTO_FIJO,
} from '../schema';
import { crearGastoFijo, editarGastoFijo } from '../actions';
import { GastoFijo } from '../types';

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
import { CATEGORIA_GASTO_LABELS, FRECUENCIA_GASTO_LABELS, ESTADO_STYLES } from '@/lib/constants';
import { MONEDAS } from '@/lib/moneda';

interface GastoFijoFormProps {
    gastoFijo?: GastoFijo; // si viene, es edición
    onSuccess?: () => void;
}

export function GastoFijoForm({ gastoFijo, onSuccess }: GastoFijoFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(gastoFijo);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<GastoFijoInput>({
        resolver: zodResolver(GastoFijoSchema),
        defaultValues: {
            nombre: gastoFijo?.nombre ?? '',
            categoria: gastoFijo?.categoria ?? 'SOFTWARE',
            monto: gastoFijo?.monto ?? 0,
            moneda: gastoFijo?.moneda ?? 'ARS',
            frecuencia: gastoFijo?.frecuencia ?? 'MENSUAL',
            fechaInicio: gastoFijo?.fechaInicio ?? new Date(),
            estado: gastoFijo?.estado,
            notas: gastoFijo?.notas ?? '',
        },
    });

    function onSubmit(data: GastoFijoInput) {
        startTransition(async () => {
            try {
                if (esEdicion && gastoFijo) {
                    await editarGastoFijo(gastoFijo.id, data);
                    toast.success('Gasto fijo actualizado');
                } else {
                    await crearGastoFijo(data);
                    toast.success('Gasto fijo creado');
                }
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el gasto fijo');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input id="nombre" placeholder="Ej: Adobe Creative Cloud" {...register('nombre')} />
                {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
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
                                    {FRECUENCIAS_GASTO.map((frecuencia) => (
                                        <SelectItem key={frecuencia} value={frecuencia}>
                                            {FRECUENCIA_GASTO_LABELS[frecuencia]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-1.5">
                    <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
                    <Input
                        id="fechaInicio"
                        type="date"
                        {...register('fechaInicio')}
                        defaultValue={
                            gastoFijo?.fechaInicio
                                ? new Date(gastoFijo.fechaInicio).toISOString().split('T')[0]
                                : new Date().toISOString().split('T')[0]
                        }
                    />
                    {errors.fechaInicio && <p className="text-sm text-red-600">{errors.fechaInicio.message}</p>}
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
                                    {ESTADOS_GASTO_FIJO.map((estado) => (
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

            <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" rows={3} {...register('notas')} />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear gasto fijo'}
            </Button>
        </form>
    );
}
