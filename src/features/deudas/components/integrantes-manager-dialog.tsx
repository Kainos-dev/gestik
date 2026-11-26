// src/features/deudas/components/integrantes-manager-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Trash2, X } from 'lucide-react';

import { IntegranteSchema, IntegranteInput } from '../schema';
import { crearIntegrante, editarIntegrante, eliminarIntegrante, toggleIntegranteActivo } from '../actions';
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

type Modo = 'VER' | 'EDITAR' | 'CONFIRMAR_ELIMINAR';

function EditarNombreForm({ integrante, onListo }: { integrante: Integrante; onListo: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { register, handleSubmit, formState: { errors } } = useForm<IntegranteInput>({
        resolver: zodResolver(IntegranteSchema),
        defaultValues: { nombre: integrante.nombre },
    });

    function onSubmit(data: IntegranteInput) {
        startTransition(async () => {
            try {
                const resultado = await editarIntegrante(integrante.id, data);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                }
                toast.success('Nombre actualizado');
                router.refresh();
                onListo();
            } catch (error) {
                toast.error('Ocurrió un error al actualizar el nombre');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 items-start gap-1">
            <div className="flex-1">
                <Input autoFocus aria-label="Nombre" {...register('nombre')} />
                {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
            </div>
            <Button type="submit" size="icon" variant="ghost" aria-label="Guardar nombre" disabled={isPending}>
                <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Cancelar" disabled={isPending} onClick={onListo}>
                <X className="h-4 w-4" />
            </Button>
        </form>
    );
}

function IntegranteRow({ integrante }: { integrante: Integrante }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [modo, setModo] = useState<Modo>('VER');
    const cantidadDeudas = integrante.cantidadDeudas ?? 0;
    const tieneDeudas = cantidadDeudas > 0;

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

    function eliminar() {
        startTransition(async () => {
            try {
                const resultado = await eliminarIntegrante(integrante.id);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    setModo('VER');
                    return;
                }
                toast.success('Integrante eliminado');
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al eliminar el integrante');
                console.error(error);
            }
        });
    }

    if (modo === 'EDITAR') {
        return (
            <div className="rounded-md border px-3 py-2">
                <EditarNombreForm integrante={integrante} onListo={() => setModo('VER')} />
                {tieneDeudas && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        El nombre nuevo se verá en sus {cantidadDeudas} deuda{cantidadDeudas === 1 ? '' : 's'}.
                    </p>
                )}
            </div>
        );
    }

    if (modo === 'CONFIRMAR_ELIMINAR') {
        return (
            <div className="space-y-2 rounded-md border border-destructive/50 px-3 py-2">
                <p className="text-sm">
                    ¿Eliminar a <span className="font-medium">{integrante.nombre}</span>? Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={isPending} onClick={() => setModo('VER')}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" size="sm" disabled={isPending} onClick={eliminar}>
                        {isPending ? 'Eliminando...' : 'Eliminar'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-md border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <span className={integrante.activo ? 'truncate' : 'truncate text-muted-foreground line-through'}>
                    {integrante.nombre}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar nombre de ${integrante.nombre}`}
                        disabled={isPending}
                        onClick={() => setModo('EDITAR')}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar a ${integrante.nombre}`}
                        title={tieneDeudas ? 'Tiene deudas asociadas: no se puede eliminar, podés desactivarla' : undefined}
                        disabled={isPending || tieneDeudas}
                        onClick={() => setModo('CONFIRMAR_ELIMINAR')}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={isPending} onClick={toggle}>
                        {integrante.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                </div>
            </div>
            {tieneDeudas && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {cantidadDeudas} deuda{cantidadDeudas === 1 ? '' : 's'} asociada{cantidadDeudas === 1 ? '' : 's'}: no se
                    puede eliminar para no perder su historial. Podés desactivarla.
                </p>
            )}
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
                const resultado = await crearIntegrante(data);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                }
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
            <DialogTrigger render={<Button variant="outline">Gestionar Integrantes</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Integrantes</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto">
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
