// src/features/gastos/components/total-a-pagar-dialog.tsx
'use client';

import { GastoFijo } from '../types';
import { filtrarGastosFijosDelMes, calcularTotalPorMoneda, calcularEstadoPagoGastoFijo } from '../services';
import { formatCurrency } from '@/lib/moneda';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '@/components/ui/dialog';

function nombreMesActual(): string {
    const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date());
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function TotalAPagarDialog({ gastosFijos }: { gastosFijos: GastoFijo[] }) {
    const gastosDelMes = filtrarGastosFijosDelMes(gastosFijos);
    const totales = calcularTotalPorMoneda(gastosDelMes).filter((t) => t.total > 0);

    return (
        <Dialog>
            <DialogTrigger render={<Button variant="outline">Total a pagar este mes</Button>} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Total a pagar — {nombreMesActual()}</DialogTitle>
                    <DialogDescription>
                        Gastos fijos activos que vencen este mes o quedaron atrasados de antes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {totales.length ? (
                            totales.map((t) => (
                                <div key={t.moneda} className="rounded-md border px-3 py-2">
                                    <div className="text-xs text-muted-foreground">{t.moneda}</div>
                                    <div className="text-xl font-semibold">{formatCurrency(t.total, t.moneda)}</div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No hay gastos fijos pendientes este mes.</p>
                        )}
                    </div>

                    {gastosDelMes.length > 0 && (
                        <div className="space-y-2">
                            {gastosDelMes.map((gastoFijo) => {
                                const estadoPago = calcularEstadoPagoGastoFijo(gastoFijo.estado, gastoFijo.proximoVencimiento);
                                return (
                                    <div key={gastoFijo.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div>
                                            <div className="text-sm font-medium">{gastoFijo.nombre}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Vence {gastoFijo.proximoVencimiento ? formatDate(gastoFijo.proximoVencimiento) : '—'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {estadoPago && <StatusBadge value={estadoPago} />}
                                            <span className="text-sm font-medium">
                                                {formatCurrency(gastoFijo.monto, gastoFijo.moneda)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
