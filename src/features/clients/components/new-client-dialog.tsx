// src/features/clientes/components/nuevo-cliente-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClienteForm } from './client-form';

export function NuevoClienteDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Nuevo cliente</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nuevo cliente</DialogTitle>
                </DialogHeader>
                <ClienteForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}