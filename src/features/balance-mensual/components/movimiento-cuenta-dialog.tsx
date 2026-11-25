// src/features/balance-mensual/components/movimiento-cuenta-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';

import { MovimientoCuentaSchema, MovimientoCuentaInput } from '../schema';
import { registrarMovimientoCuenta } from '../actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImporteInterpretadoCampo } from '@/components/shared/importe-interpretado';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/shared/date-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

type TipoMovimientoManual = MovimientoCuentaInput['tipo'];
type CuentaManual = MovimientoCuentaInput['cuenta'];

type Textos = { boton: string; titulo: string; descripcion: string; exito: string };

const TEXTOS: Record<CuentaManual, Record<TipoMovimientoManual, Textos>> = {
    CUENTA: {
        INGRESO: {
            boton: 'Ingresar',
            titulo: 'Ingresar plata a la cuenta',
            descripcion: 'Para plata que entra a la cuenta y no es un pago de cliente ya registrado en Cobros.',
            exito: 'Ingreso registrado',
        },
        RETIRO: {
            boton: 'Retirar',
            titulo: 'Retirar plata de la cuenta',
            descripcion: 'Para plata que sale de la cuenta y no es un gasto ni una reposición de deuda ya registrados.',
            exito: 'Retiro registrado',
        },
    },
    CAJA_AHORRO: {
        INGRESO: {
            boton: 'Ingresar',
            titulo: 'Ingresar plata a la caja de ahorro',
            descripcion: 'Plata que se aparta para ahorro.',
            exito: 'Ingreso a la caja registrado',
        },
        RETIRO: {
            boton: 'Retirar',
            titulo: 'Retirar plata de la caja de ahorro',
            descripcion: 'Para plata que sale de la caja y no es un gasto ya registrado con la caja de ahorro.',
            exito: 'Retiro de la caja registrado',
        },
    },
};

function MovimientoCuentaForm({
    tipo,
    cuenta,
    onSuccess,
}: {
    tipo: TipoMovimientoManual;
    cuenta: CuentaManual;
    onSuccess: () => void;
}) {
    const textos = TEXTOS[cuenta][tipo];
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<MovimientoCuentaInput>({
        resolver: zodResolver(MovimientoCuentaSchema),
        defaultValues: { tipo, cuenta, monto: undefined, fecha: new Date(), descripcion: '' },
    });

    function onSubmit(data: MovimientoCuentaInput) {
        startTransition(async () => {
            try {
                await registrarMovimientoCuenta(data);
                toast.success(textos.exito);
                router.refresh();
                onSuccess();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el movimiento');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="monto">Monto (ARS) *</Label>
                    <Input id="monto" type="text" inputMode="decimal" autoComplete="off" placeholder="Ej: 50.000" {...register('monto')} />
                    <ImporteInterpretadoCampo control={control} name="monto" moneda="ARS" />
                    {errors.monto && <p className="text-sm text-red-600">{errors.monto.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <Controller
                        control={control}
                        name="fecha"
                        render={({ field }) => (
                            <DatePicker id="fecha" value={field.value as Date | undefined} onChange={field.onChange} />
                        )}
                    />
                    {errors.fecha && <p className="text-sm text-red-600">{errors.fecha.message}</p>}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input id="descripcion" placeholder="Opcional" {...register('descripcion')} />
                {errors.descripcion && <p className="text-sm text-red-600">{errors.descripcion.message}</p>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : textos.boton}
            </Button>
        </form>
    );
}

function MovimientoCuentaDialog({ tipo, cuenta }: { tipo: TipoMovimientoManual; cuenta: CuentaManual }) {
    const [open, setOpen] = useState(false);
    const textos = TEXTOS[cuenta][tipo];
    const Icono = tipo === 'INGRESO' ? Plus : Minus;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="outline" size="sm">
                        <Icono className="h-4 w-4" />
                        {textos.boton}
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{textos.titulo}</DialogTitle>
                    <DialogDescription>{textos.descripcion}</DialogDescription>
                </DialogHeader>
                <MovimientoCuentaForm tipo={tipo} cuenta={cuenta} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}

// Botones "Ingresar" / "Retirar" de las tarjetas "Plata disponible en
// cuenta" y "Caja de ahorro".
export function AccionesCuenta({ cuenta }: { cuenta: CuentaManual }) {
    return (
        <div className="flex gap-2">
            <MovimientoCuentaDialog tipo="INGRESO" cuenta={cuenta} />
            <MovimientoCuentaDialog tipo="RETIRO" cuenta={cuenta} />
        </div>
    );
}
