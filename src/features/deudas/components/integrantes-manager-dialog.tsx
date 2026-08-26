// src/features/deudas/components/integrantes-manager-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { IntegranteSchema, IntegranteInput } from '../schema';
import { crearIntegrante, toggleIntegranteActivo } from '../actions';
import { Integrante } from '../types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

function IntegranteRow({ integrante }: { integrante: Integrante }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    function toggle() {
        startTransition(async () => {
            try {
                await toggleIntegranteActivo(integrante.id);
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al actualizar el integrante');
                console.error(error);
            }
        });
    }

    return (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className={integrante.activo ? '' : 'text-muted-foreground line-through'}>{integrante.nombre}</span>
            <Button variant="outline" size="sm" disabled={isPending} onClick={toggle}>
                {integrante.activo ? 'Desactivar' : 'Activar'}
            </Button>
        </div>
    );
}

function NuevoIntegranteForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { register, handleSubmit, reset, formState: { errors } } = useForm<IntegranteInput>({
        resolver: zodResolver(IntegranteSchema),
        defaultValues: { nombre: '' },
    });

    function onSubmit(data: IntegranteInput) {
        startTransition(async () => {
            try {
                await crearIntegrante(data);
                toast.success('Integrante agregado');
                reset();
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al agregar el integrante');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
            <div className="flex-1">
                <Input placeholder="Nombre del integrante" {...register('nombre')} />
                {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
            </div>
            <Button type="submit" disabled={isPending}>
                Agregar
            </Button>
        </form>
    );
}

export function IntegrantesManagerDialog({ integrantes }: { integrantes: Integrante[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline">Gestionar integrantes</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Integrantes</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        {integrantes.length ? (
                            integrantes.map((integrante) => <IntegranteRow key={integrante.id} integrante={integrante} />)
                        ) : (
                            <p className="text-sm text-muted-foreground">Todavía no hay integrantes cargados.</p>
                        )}
                    </div>
                    <NuevoIntegranteForm />
                </div>
            </DialogContent>
        </Dialog>
    );
}
