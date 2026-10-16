// src/features/balance-mensual/components/tarjeta-saldo.tsx
'use client';

import { ReactNode, useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TarjetaSaldoProps {
    titulo: string;
    explicacion: string; // tooltip "cómo se calcula"
    align: 'start' | 'end'; // del tooltip — "end" si la tarjeta queda pegada al borde derecho
    children: ReactNode; // valor + pie de la tarjeta
    detalle: ReactNode; // historial de movimientos, ya renderizado en el servidor
}

// Tarjeta grande (más que las KPI de arriba) para un saldo acumulado
// ("Plata disponible en cuenta", "Caja de ahorro"). Clickeable como
// KpiDetalleCard, pero no puede ser un <button>: adentro tiene el trigger
// del tooltip, que ya es un botón — así que es un div con role="button".
export function TarjetaSaldo({ titulo, explicacion, align, children, detalle }: TarjetaSaldoProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
                className="cursor-pointer text-left"
            >
                <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-1.5 text-base font-medium text-muted-foreground">
                            {titulo}
                            <Tooltip>
                                <TooltipTrigger
                                    aria-label="Cómo se calcula este número"
                                    className="inline-flex cursor-help text-muted-foreground"
                                    // Que tocar el ícono no abra además el historial.
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <Info className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent align={align}>{explicacion}</TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {children}
                        <p className="text-xs text-muted-foreground">Ver últimos movimientos</p>
                    </CardContent>
                </Card>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{titulo}</DialogTitle>
                        <DialogDescription>
                            Últimos 10 movimientos, del más nuevo al más viejo. &quot;Saldo&quot; es cómo quedó la
                            cuenta después de cada uno.
                        </DialogDescription>
                    </DialogHeader>
                    {detalle}
                </DialogContent>
            </Dialog>
        </>
    );
}
