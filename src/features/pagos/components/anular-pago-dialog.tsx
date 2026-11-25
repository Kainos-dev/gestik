// src/features/pagos/components/anular-pago-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { anularPago } from '../actions';
import { Pago } from '../types';
import { formatCurrency } from '@/lib/moneda';
import { formatDate } from '@/lib/utils';
import { TIPO_SERVICIO_LABELS } from '@/lib/constants';

// Confirmación en un diálogo propio (no un window.confirm), con motivo
// obligatorio para la auditoría: hay que escribirlo y tocar el botón rojo.
export function AnularPagoDialog({ pago }: { pago: Pago }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [isPending, startTransition] = useTransition();
    const motivoValido = motivo.trim().length >= 3;

    function cambiarApertura(abierto: boolean) {
        if (abierto) setMotivo('');
        setOpen(abierto);
    }

    function confirmar() {
        startTransition(async () => {
            try {
                const resultado = await anularPago(pago.id, motivo);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                }
                toast.success('Cobro anulado. Lo podés restaurar desde "Anulados".');
                setOpen(false);
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al anular el cobro');
                console.error(error);
            }
        });
    }

    const servicio = pago.servicioNombre ? (TIPO_SERVICIO_LABELS[pago.servicioNombre] ?? pago.servicioNombre) : null;
    const convertido = pago.monedaPago !== pago.moneda;

    return (
        <Dialog open={open} onOpenChange={cambiarApertura}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Anular cobro">
                        <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>¿Anular este cobro?</DialogTitle>
                    <DialogDescription>
                        {pago.clienteNombre} · {formatCurrency(pago.montoPagado, pago.monedaPago)} · {formatDate(pago.fecha)}
                        {servicio ? ` · ${servicio}` : ''}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm text-muted-foreground">
                    {convertido && (
                        <p>
                            Se había acreditado como {formatCurrency(pago.monto, pago.moneda)}
                            {pago.tipoCambio ? ` (cotización ${formatCurrency(pago.tipoCambio, 'ARS')})` : ''}.
                        </p>
                    )}
                    <p>
                        Deja de contar en el saldo del servicio, la cuenta, Balance Mensual y Gestión. No se borra: queda en
                        &quot;Anulados&quot; con su cotización original y se puede restaurar.
                    </p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`motivo-${pago.id}`}>Motivo *</Label>
                    <Textarea
                        id={`motivo-${pago.id}`}
                        rows={2}
                        placeholder="Ej: cobro de prueba, cargado por error"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirmar} disabled={isPending || !motivoValido}>
                        {isPending ? 'Anulando...' : 'Anular cobro'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
