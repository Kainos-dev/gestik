// src/features/clientes/components/cliente-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { ClienteSchema, ESTADOS_CLIENTE } from '../schema';
import { crearCliente, editarCliente } from '../actions';
import { Cliente } from '../types';

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
import { ESTADO_STYLES } from '@/lib/constants';
import { CLIENT_COLOR_PALETTE } from '@/lib/client-colors';
import { cn } from '@/lib/utils';

// Tipo específico de este formulario: los campos base de ClienteSchema
// + estado y color, que sólo se editan acá (nunca en el alta: el estado
// nace ACTIVO y el color se asigna automático — ver pickClientColor).
const ClienteFormSchema = ClienteSchema.extend({
    estado: z.enum(ESTADOS_CLIENTE).optional(),
    color: z.string().optional(),
});

type ClienteFormInput = z.input<typeof ClienteFormSchema>;
type ClienteFormValues = z.output<typeof ClienteFormSchema>;

interface ClienteFormProps {
    cliente?: Cliente;
    onSuccess?: () => void;
}

export function ClienteForm({ cliente, onSuccess }: ClienteFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(cliente);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<ClienteFormInput, any, ClienteFormValues>({
        resolver: zodResolver(ClienteFormSchema),
        defaultValues: {
            nombre: cliente?.nombre ?? '',
            empresa: cliente?.empresa ?? '',
            email: cliente?.email ?? '',
            whatsapp: cliente?.whatsapp ?? '',
            observaciones: cliente?.observaciones ?? '',
            estado: cliente?.estado,
            color: cliente?.color,
        },
    });

    function onSubmit(data: ClienteFormValues) {
        startTransition(async () => {
            try {
                if (esEdicion && cliente) {
                    // en edición sí mandamos estado
                    await editarCliente(cliente.id, data);
                    toast.success('Cliente actualizado');
                } else {
                    // en alta, estado no se manda (nace ACTIVO por default en la DB)
                    const { estado, ...dataAlta } = data;
                    await crearCliente(dataAlta);
                    toast.success('Cliente creado');
                }
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el cliente');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input id="nombre" {...register('nombre')} />
                {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="empresa">Empresa</Label>
                <Input id="empresa" {...register('empresa')} />
                {errors.empresa && <p className="text-sm text-red-600">{errors.empresa.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" {...register('whatsapp')} />
                    {errors.whatsapp && <p className="text-sm text-red-600">{errors.whatsapp.message}</p>}
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
                                    {ESTADOS_CLIENTE.map((estado) => (
                                        <SelectItem key={estado} value={estado}>
                                            {ESTADO_STYLES[estado]?.label ?? estado}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.estado && <p className="text-sm text-red-600">{errors.estado.message}</p>}
                </div>
            )}

            {esEdicion && (
                <div className="space-y-1.5">
                    <Label>Color identificador</Label>
                    <Controller
                        name="color"
                        control={control}
                        render={({ field }) => (
                            <div className="flex flex-wrap gap-2">
                                {CLIENT_COLOR_PALETTE.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        aria-label={`Elegir color ${color}`}
                                        onClick={() => field.onChange(color)}
                                        className={cn(
                                            'h-6 w-6 rounded-full ring-offset-2 ring-offset-background transition-shadow',
                                            field.value === color ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-muted-foreground/50'
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        )}
                    />
                </div>
            )}

            <div className="space-y-1.5">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea id="observaciones" rows={4} {...register('observaciones')} />
                {errors.observaciones && <p className="text-sm text-red-600">{errors.observaciones.message}</p>}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
        </form>
    );
}