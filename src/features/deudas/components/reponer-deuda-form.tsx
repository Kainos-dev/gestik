// src/features/deudas/components/reponer-deuda-form.tsx
'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { ReposicionDeudaSchema, ReposicionDeudaInput } from '../schema';
import { reponerDeuda } from '../actions';
import { calcularMontoReposicion } from '../services';
import { Deuda } from '../types';

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
import { MONEDAS, formatCurrency } from '@/lib/moneda';
import { DatePicker } from '@/components/shared/date-picker';

export function ReponerDeudaForm({ deuda, onSuccess }: { deuda: Deuda; onSuccess?: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<ReposicionDeudaInput>({
        resolver: zodResolver(ReposicionDeudaSchema),
        defaultValues: {
            montoPagado: 0,
            monedaPago: deuda.moneda,
            tipoCambio: undefined,
            fecha: new Date(),
            notas: '',
        },
    });

    const montoPagado = useWatch({ control, name: 'montoPagado' });
    const monedaPago = useWatch({ control, name: 'monedaPago' });
    const tipoCambio = useWatch({ control, name: 'tipoCambio' });
    const requiereConversion = monedaPago !== deuda.moneda;

    let preview: number | null = null;
    if (requiereConversion && tipoCambio) {
        try {
            preview = calcularMontoReposicion(Number(montoPagado) || 0, monedaPago, deuda.moneda, Number(tipoCambio));
        } catch {
            preview = null;
        }
    }

    function onSubmit(data: ReposicionDeudaInput) {
        if (requiereConversion && !data.tipoCambio) {
            toast.error('Ingresá el tipo de cambio para convertir la reposición');
            return;
        }

        startTransition(async () => {
            try {
                await reponerDeuda(deuda.id, data);
                toast.success('Reposición registrada');
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al registrar la reposición');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Falta reponer {formatCurrency(deuda.montoTotal - deuda.montoRepuesto, deuda.moneda)} de{' '}
                {formatCurrency(deuda.montoTotal, deuda.moneda)}.
            </p>

            <div className="space-y-1.5">
                <Label htmlFor="montoPagado">Monto que se repone *</Label>
                <div className="flex gap-2">
                    <Input id="montoPagado" type="number" step="0.01" className="flex-1" {...register('montoPagado')} />
                    <Controller
                        name="monedaPago"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="monedaPago" className="w-24">
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
                {errors.montoPagado && <p className="text-sm text-red-600">{errors.montoPagado.message}</p>}
            </div>

            {requiereConversion && (
                <div className="space-y-1.5">
                    <Label htmlFor="tipoCambio">Tipo de cambio (ARS por USD) *</Label>
                    <Input id="tipoCambio" type="number" step="0.0001" placeholder="Ej: 1000" {...register('tipoCambio')} />
                    <p className="text-sm text-muted-foreground">
                        {preview !== null
                            ? `Se acreditan ${formatCurrency(preview, deuda.moneda)} a la deuda.`
                            : 'Ingresá el tipo de cambio para ver cuánto se acredita a la deuda.'}
                    </p>
                </div>
            )}

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
                {isPending ? 'Guardando...' : 'Reponer'}
            </Button>
        </form>
    );
}
