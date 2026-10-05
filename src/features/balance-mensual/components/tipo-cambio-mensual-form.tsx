// src/features/balance-mensual/components/tipo-cambio-mensual-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { TipoCambioMensualSchema, TipoCambioMensualInput } from '../schema';
import { registrarTipoCambioMensual } from '../actions';
import { MesPendienteDeReparto } from '../types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/moneda';

const MESES_LARGOS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMesLargo(mes: Date): string {
    const f = new Date(mes);
    return `${MESES_LARGOS[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

// Carga el tipo de cambio del mes más viejo pendiente (ver domain model,
// PD1): hace falta porque ese mes facturó algo en USD y el ahorro acumulado
// necesita una sola cifra en pesos. Una vez cargado, el server action
// también intenta seguir con los meses pendientes que ya tenían USD=0.
export function TipoCambioMensualForm({ mes, onSuccess }: { mes: MesPendienteDeReparto; onSuccess?: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<TipoCambioMensualInput>({
        resolver: zodResolver(TipoCambioMensualSchema),
        defaultValues: { mes: mes.mes, tipoCambio: undefined },
    });

    function onSubmit(data: TipoCambioMensualInput) {
        startTransition(async () => {
            try {
                await registrarTipoCambioMensual(data);
                toast.success(`Reparto de ${formatMesLargo(mes.mes)} generado`);
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al generar el reparto');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {formatMesLargo(mes.mes)} facturó {formatCurrency(mes.facturadoUsd, 'USD')} (y{' '}
                {formatCurrency(mes.facturadoArs, 'ARS')}). Para repartir la porción en dólares en sueldos/ahorro/
                gastos, ingresá el tipo de cambio (ARS por USD) que corresponde a ese mes.
            </p>

            <div className="space-y-1.5">
                <Label htmlFor="tipoCambio">Tipo de cambio (ARS por USD) *</Label>
                <Input id="tipoCambio" type="number" step="0.0001" placeholder="Ej: 1000" {...register('tipoCambio')} />
                {errors.tipoCambio && <p className="text-sm text-red-600">{errors.tipoCambio.message}</p>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : 'Generar reparto'}
            </Button>
        </form>
    );
}
