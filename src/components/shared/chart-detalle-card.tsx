// src/components/shared/chart-detalle-card.tsx
'use client';

import { ReactNode, useState } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ChartDetalleCardProps {
    titulo: string;
    descripcion?: string;
    children: ReactNode; // el gráfico, siempre visible en la tarjeta
    detalle: ReactNode; // tabla con el detalle numérico, sólo dentro del dialog
}

// Mismo patrón que KpiDetalleCard (dashboard/components) pero para una
// tarjeta cuyo contenido principal es un gráfico en vez de un único número:
// el gráfico queda siempre visible (el tooltip al pasar el mouse ya daba el
// número de una barra puntual) y un botón "Ver detalle" abre un dialog con
// la tabla completa de los 6 meses, para verlos todos juntos sin tener que
// pasar el mouse barra por barra.
export function ChartDetalleCard({ titulo, descripcion, children, detalle }: ChartDetalleCardProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{titulo}</CardTitle>
                    <CardAction>
                        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                            Ver detalle
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent>{children}</CardContent>
            </Card>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{titulo}</DialogTitle>
                        {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
                    </DialogHeader>
                    {detalle}
                </DialogContent>
            </Dialog>
        </>
    );
}
