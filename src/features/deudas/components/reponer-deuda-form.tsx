// src/features/deudas/components/reponer-deuda-form.tsx
'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { ReposicionDeudaSchema, ReposicionDeudaInput } from '../schema';
import { reponerDeuda } from '../actions';
import { obtenerCotizacionBlue } from '@/lib/cotizacion-dolar-actions';
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
import { dateToSqlDateString, formatDate } from '@/lib/utils';
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
            fecha: new Date(),
            notas: '',
        },
    });

    const montoPagado = useWatch({ control, name: 'montoPagado' });
    const monedaPago = useWatch({ control, name: 'monedaPago' });
    const fecha = useWatch({ control, name: 'fecha' });
    const requiereConversion = monedaPago !== deuda.moneda;
    const fechaSql = fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? dateToSqlDateString(fecha) : null;

    // Sólo informativa: el servidor vuelve a resolver la cotización al
    // guardar (ver reponerDeuda), así que no se puede mandar una distinta.
    const cotizacion = useQuery({
        queryKey: ['cotizacion-blue-venta', fechaSql],
        queryFn: () => obtenerCotizacionBlue(fechaSql!),
        enabled: requiereConversion && fechaSql !== null,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
    const cotizacionOk = cotizacion.data?.ok ? cotizacion.data : null;
    const errorCotizacion = cotizacion.isError
        ? 'No se pudo obtener la cotización del dólar blue. Probá de nuevo.'
        : cotizacion.data && !cotizacion.data.ok
          ? cotizacion.data.error
          : null;

    let preview: number | null = null;
    if (requiereConversion && cotizacionOk) {
        preview = calcularMontoReposicion(Number(montoPagado) || 0, monedaPago, deuda.moneda, cotizacionOk.venta);
    }

    const sinCotizacion = requiereConversion && !cotizacionOk;

    function onSubmit(data: ReposicionDeudaInput) {
        startTransition(async () => {
            try {
                const resultado = await reponerDeuda(deuda.id, data);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    // Si falló por la cotización, refrescar la que se muestra.
                    if (requiereConversion) cotizacion.refetch();
                    return;
                }
                toast.success(
                    resultado.tipoCambio
                        ? `Reposición registrada: se acreditaron ${formatCurrency(resultado.montoAcreditado, deuda.moneda)} (blue venta ${formatCurrency(resultado.tipoCambio, 'ARS')})`
                        : 'Reposición registrada'
                );
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
                <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {cotizacion.isFetching ? (
                        <p className="text-muted-foreground">Buscando la cotización del dólar blue…</p>
                    ) : cotizacionOk ? (
                        <>
                            <p>
                                Cotización aplicada: <span className="font-medium">{formatCurrency(cotizacionOk.venta, 'ARS')}</span>{' '}
                                <span className="text-muted-foreground">
                                    (dólar blue venta del {formatDate(cotizacionOk.fecha)})
                                </span>
                            </p>
                            <p className="text-muted-foreground">
                                Se acreditan {formatCurrency(preview ?? 0, deuda.moneda)} a la deuda.
                            </p>
                        </>
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-red-600">{errorCotizacion ?? 'Falta la cotización del dólar blue.'}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => cotizacion.refetch()}>
                                <RefreshCw className="h-4 w-4" />
                                Reintentar
                            </Button>
                        </div>
                    )}
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

            <Button type="submit" disabled={isPending || sinCotizacion} className="w-full">
                {isPending ? 'Guardando...' : 'Reponer'}
            </Button>
        </form>
    );
}
