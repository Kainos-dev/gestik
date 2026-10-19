// src/features/balance-mensual/components/tipo-cambio-mensual-gate.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MesPendienteDeReparto } from '../types';
import { TipoCambioMensualForm } from './tipo-cambio-mensual-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

// Se muestra sólo cuando hay al menos un mes cerrado con USD que no se
// pudieron pasar a pesos porque no hay ninguna cotización del blue guardada
// (la API no respondió nunca) y por eso no tiene reparto (ver
// getMesesPendientesDeReparto): el mes
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
                            No se pudo obtener la cotización del dólar blue de un mes con cobros en USD: hay que
                            cargarla a mano para generar su reparto de sueldo/gastos/ahorro
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
                            Necesario para pasar a pesos lo facturado en dólares ese mes.
                        </DialogDescription>
                    </DialogHeader>
                    <TipoCambioMensualForm mes={mesMasViejo} onSuccess={() => setOpen(false)} />
                </DialogContent>
            </Dialog>
        </>
    );
}
