// src/features/deudas/components/reponer-deuda-dialog.tsx
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
import { ReponerDeudaForm } from './reponer-deuda-form';
import { Deuda } from '../types';

export function ReponerDeudaDialog({ deuda }: { deuda: Deuda }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm">Reponer</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reponer &quot;{deuda.descripcion}&quot;</DialogTitle>
                </DialogHeader>
                <ReponerDeudaForm deuda={deuda} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
