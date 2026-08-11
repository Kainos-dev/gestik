// src/features/servicios/components/renovar-servicio-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Servicio } from '../types';
import { renovarServicio } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TIPO_SERVICIO_LABELS } from '@/lib/constants';

function nombreServicio(servicio: Servicio) {
    return servicio.tipo === 'OTRO' ? servicio.nombrePersonalizado ?? 'Otro' : TIPO_SERVICIO_LABELS[servicio.tipo];
}

export function RenovarServicioDialog({ servicio }: { servicio: Servicio }) {
    const [open, setOpen] = useState(false);
    const [precio, setPrecio] = useState(String(servicio.precio));
    const [isPending, startTransition] = useTransition();

    // Un servicio único no vence, y uno pausado/finalizado no se renueva
    if (servicio.frecuencia === 'UNICO' || servicio.estado !== 'ACTIVO') return null;

    function handleOpenChange(next: boolean) {
        if (next) setPrecio(String(servicio.precio)); // resetea al precio actual cada vez que se abre
        setOpen(next);
    }

    function handleRenovar() {
        const nuevoPrecio = Number(precio);
        if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
            toast.error('El precio debe ser un número mayor a 0');
            return;
        }

        startTransition(async () => {
            try {
                await renovarServicio(servicio.id, nuevoPrecio);
                toast.success('Servicio renovado, cargo generado');
                setOpen(false);
            } catch (error) {
                toast.error('Ocurrió un error al renovar el servicio');
                console.error(error);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="sm">Renovar</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Renovar &quot;{nombreServicio(servicio)}&quot;</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Cliente: {servicio.clienteNombre}. Se va a generar un nuevo cargo y el próximo vencimiento va a
                        avanzar al siguiente período.
                    </p>

                    <div className="space-y-1.5">
                        <Label htmlFor="nuevoPrecio">Precio ({servicio.moneda})</Label>
                        <Input
                            id="nuevoPrecio"
                            type="number"
                            step="0.01"
                            value={precio}
                            onChange={(e) => setPrecio(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Dejalo igual para renovar con el mismo precio, o cambialo si corresponde un ajuste.
                        </p>
                    </div>

                    <Button onClick={handleRenovar} disabled={isPending} className="w-full">
                        {isPending ? 'Renovando...' : 'Renovar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
