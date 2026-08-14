// src/features/gastos/components/edit-gasto-fijo-dialog.tsx
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
import { GastoFijoForm } from './gasto-fijo-form';
import { GastoFijo } from '../types';

export function EditarGastoFijoDialog({ gastoFijo }: { gastoFijo: GastoFijo }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Editar gasto fijo">
                        <Pencil className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar gasto fijo</DialogTitle>
                </DialogHeader>
                <GastoFijoForm gastoFijo={gastoFijo} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
