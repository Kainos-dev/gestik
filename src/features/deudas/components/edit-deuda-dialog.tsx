// src/features/deudas/components/edit-deuda-dialog.tsx
'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { DeudaForm } from './deuda-form';
import { Deuda, Integrante } from '../types';

export function EditarDeudaDialog({ deuda, integrantes }: { deuda: Deuda; integrantes: Integrante[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Editar deuda">
                        <Pencil className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar deuda</DialogTitle>
                </DialogHeader>
                <DeudaForm deuda={deuda} integrantes={integrantes} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
