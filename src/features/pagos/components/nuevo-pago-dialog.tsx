// src/features/pagos/components/nuevo-pago-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PagoForm } from './pago-form';
import { Cliente } from '@/features/clients/types';

export function NuevoPagoDialog({
    clientes,
    clienteIdFijo,
    clienteIdInicial,
}: {
    clientes: Cliente[];
    clienteIdFijo?: string; // no se puede cambiar (ej. desde el detalle de un cliente)
    clienteIdInicial?: string; // precargado pero editable (ej. el cliente filtrado en Cobros)
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Registrar cobro</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Cobro</DialogTitle>
                </DialogHeader>
                {/* Se monta al abrir, para que arranque limpio y con el cliente filtrado en ese momento. */}
                {open && (
                    <PagoForm
                        clientes={clientes}
                        clienteIdFijo={clienteIdFijo}
                        clienteIdInicial={clienteIdInicial}
                        onSuccess={() => setOpen(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
