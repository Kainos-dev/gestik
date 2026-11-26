// src/features/dashboard/components/kpi-detalle-card.tsx
'use client';

import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KpiDetalleCardProps {
    label: ReactNode; // string simple, o JSX con el mes aclarado en una segunda línea (ver dashboard/page.tsx)
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
            {/* size="sm" + h-full: tarjeta compacta (Balance Mensual entra en
                una pantalla) y todas las de una fila con el mismo alto. */}
            <button type="button" onClick={() => setOpen(true)} className="h-full text-left cursor-pointer">
                <Card size="sm" className="h-full gap-2 transition-colors hover:bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground lg:text-[clamp(0.875rem,1.6vh,1.0625rem)]">{label}</CardTitle>
                    </CardHeader>
                    <CardContent className="mt-auto">
                        {/* En escritorio el tamaño acompaña el alto de la ventana (Balance Mensual ocupa toda la pantalla). */}
                        <div className="text-2xl font-semibold lg:text-[clamp(1.5rem,3.6vh,2.75rem)]">{value}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Ver detalle</p>
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
