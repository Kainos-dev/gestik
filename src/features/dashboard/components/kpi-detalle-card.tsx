// src/features/dashboard/components/kpi-detalle-card.tsx
'use client';

import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KpiDetalleCardProps {
    label: string;
    value: string;
    descripcion: string;
    children: ReactNode; // detalle ya renderizado en el servidor
}

// Igual que KpiCard, pero clickeable: abre un dialog con el detalle de los
// movimientos que componen el número.
export function KpiDetalleCard({ label, value, descripcion, children }: KpiDetalleCardProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="text-left cursor-pointer">
                <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{value}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Ver detalle</p>
                    </CardContent>
                </Card>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                        <DialogDescription>{descripcion}</DialogDescription>
                    </DialogHeader>
                    {children}
                </DialogContent>
            </Dialog>
        </>
    );
}
