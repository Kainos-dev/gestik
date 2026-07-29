// src/features/clientes/components/editar-cliente-dialog.tsx
'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClienteForm } from './client-form';
import { Cliente } from '../types';

export function EditarClienteDialog({ cliente }: { cliente: Cliente }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Editar cliente">
                        <Pencil className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar cliente</DialogTitle>
                </DialogHeader>
                <ClienteForm cliente={cliente} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}