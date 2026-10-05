// src/features/balance-mensual/components/tipo-cambio-mensual-gate.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MesPendienteDeReparto } from '../types';
import { TipoCambioMensualForm } from './tipo-cambio-mensual-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

// Se muestra sólo cuando hay al menos un mes cerrado con Facturado en USD
// que todavía no tiene reparto (ver getMesesPendientesDeReparto): el mes
// más viejo es el que bloquea — hasta que se resuelva ése, los siguientes
// tampoco se generan (ver renovarRepartosMensuales).
export function TipoCambioMensualGate({ mesesPendientes }: { mesesPendientes: MesPendienteDeReparto[] }) {
    const [open, setOpen] = useState(false);

    if (mesesPendientes.length === 0) return null;

    const mesMasViejo = mesesPendientes[0];

    return (
        <>
            <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                        <p className="text-sm">
                            Falta cargar el tipo de cambio de un mes con Facturado en USD para poder generar su
                            reparto de sueldos/ahorro/gastos
                            {mesesPendientes.length > 1 ? ` (y ${mesesPendientes.length - 1} mes(es) más en cola)` : ''}.
                        </p>
                    </div>
                    <Button size="sm" onClick={() => setOpen(true)}>
                        Cargar tipo de cambio
                    </Button>
                </CardContent>
            </Card>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tipo de cambio mensual</DialogTitle>
                        <DialogDescription>
                            Necesario para convertir la porción de ahorro en dólares a pesos.
                        </DialogDescription>
                    </DialogHeader>
                    <TipoCambioMensualForm mes={mesMasViejo} onSuccess={() => setOpen(false)} />
                </DialogContent>
            </Dialog>
        </>
    );
}
