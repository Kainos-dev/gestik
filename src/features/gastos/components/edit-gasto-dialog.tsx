// src/features/gastos/components/edit-gasto-dialog.tsx
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
import { GastoForm } from './gasto-form';
import { Gasto } from '../types';

export function EditarGastoDialog({ gasto }: { gasto: Gasto }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Editar gasto">
                        <Pencil className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar gasto</DialogTitle>
                </DialogHeader>
                <GastoForm gasto={gasto} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
