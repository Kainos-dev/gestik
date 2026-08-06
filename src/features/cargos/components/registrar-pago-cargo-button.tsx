// src/features/cargos/components/registrar-pago-cargo-button.tsx
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
import { PagoForm } from '@/features/pagos/components/pago-form';
import { Cliente } from '@/features/clients/types';

interface RegistrarPagoCargoButtonProps {
    clienteId: string;
    servicioId: string;
    montoSugerido: number;
    clientes: Cliente[];
}

export function RegistrarPagoCargoButton({
    clienteId,
    servicioId,
    montoSugerido,
    clientes,
}: RegistrarPagoCargoButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm">Registrar pago</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar pago</DialogTitle>
                </DialogHeader>
                <PagoForm
                    clientes={clientes}
                    clienteIdFijo={clienteId}
                    servicioIdFijo={servicioId}
                    montoSugerido={montoSugerido}
                    onSuccess={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
