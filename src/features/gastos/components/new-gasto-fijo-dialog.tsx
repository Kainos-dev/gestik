// src/features/gastos/components/new-gasto-fijo-dialog.tsx
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
import { GastoFijoForm } from './gasto-fijo-form';

export function NuevoGastoFijoDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Nuevo gasto fijo</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nuevo gasto fijo</DialogTitle>
                </DialogHeader>
                <GastoFijoForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
