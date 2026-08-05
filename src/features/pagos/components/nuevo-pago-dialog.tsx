// src/features/pagos/components/nuevo-pago-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PagoForm } from './pago-form';
import { Cliente } from '@/features/clients/types';

export function NuevoPagoDialog({ clientes, clienteIdFijo }: { clientes: Cliente[]; clienteIdFijo?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Registrar pago</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar pago</DialogTitle>
                </DialogHeader>
                <PagoForm clientes={clientes} clienteIdFijo={clienteIdFijo} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}