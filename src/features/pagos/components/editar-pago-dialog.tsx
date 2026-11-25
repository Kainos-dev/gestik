// src/features/pagos/components/editar-pago-dialog.tsx
'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PagoForm } from './pago-form';
import { Pago } from '../types';
import { Cliente } from '@/features/clients/types';

export function EditarPagoDialog({ pago, clientes }: { pago: Pago; clientes: Cliente[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Editar cobro">
                        <Pencil className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar cobro</DialogTitle>
                </DialogHeader>
                {/* Se monta al abrir: el formulario arranca siempre con los datos actuales del cobro. */}
                {open && <PagoForm clientes={clientes} pago={pago} onSuccess={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    );
}
