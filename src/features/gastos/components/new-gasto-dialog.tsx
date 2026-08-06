// src/features/gastos/components/new-gasto-dialog.tsx
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
import { GastoForm } from './gasto-form';
import { GastoFijo } from '../types';

export function NuevoGastoDialog({ gastosFijos }: { gastosFijos: GastoFijo[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ Registrar gasto</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar gasto</DialogTitle>
                </DialogHeader>
                <GastoForm gastosFijos={gastosFijos} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
