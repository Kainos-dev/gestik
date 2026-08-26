// src/features/deudas/components/new-deuda-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { DeudaForm } from './deuda-form';
import { Integrante } from '../types';

export function NuevaDeudaDialog({ integrantes }: { integrantes: Integrante[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Nueva deuda</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar deuda</DialogTitle>
                </DialogHeader>
                <DeudaForm integrantes={integrantes} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
