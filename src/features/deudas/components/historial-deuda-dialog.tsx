// src/features/deudas/components/historial-deuda-dialog.tsx
'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import { Deuda, ReposicionDeuda } from '../types';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';

export function HistorialDeudaDialog({ deuda, reposiciones }: { deuda: Deuda; reposiciones: ReposicionDeuda[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Ver historial de reposiciones">
                        <History className="h-4 w-4" />
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Historial de &quot;{deuda.descripcion}&quot;</DialogTitle>
                </DialogHeader>
                {deuda.deudaReemplazoId && (
                    <p className="text-sm text-muted-foreground">
                        Importe original {formatCurrency(deuda.montoTotal, deuda.moneda)}.
                        El saldo se trasladó a la deuda en USD {deuda.deudaReemplazoId}.
                    </p>
                )}

                {reposiciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no se registraron reposiciones.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Acreditado</TableHead>
                                <TableHead>Pagado</TableHead>
                                <TableHead>Cotización</TableHead>
                                <TableHead>Notas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reposiciones.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>
                                        {deuda.deudaReemplazoId
                                            ? new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(r.fecha))
                                            : formatDate(r.fecha)}
                                    </TableCell>
                                    <TableCell>{r.anuladaAt ? '—' : formatCurrency(r.monto, deuda.moneda)}</TableCell>
                                    <TableCell>{r.anuladaAt ? '—' : formatCurrency(r.montoPagado, r.monedaPago)}</TableCell>
                                    <TableCell>{r.tipoCambio ? formatCurrency(r.tipoCambio, 'ARS') : '—'}</TableCell>
                                    <TableCell className="max-w-48 truncate whitespace-normal text-muted-foreground">
                                        {r.anuladaAt && (
                                            <p className="font-medium">
                                                Anulada · {formatCurrency(r.montoPagado, r.monedaPago)} · {r.motivoAnulacion}
                                            </p>
                                        )}
                                        {r.notas ?? (r.anuladaAt ? null : '—')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
        </Dialog>
    );
}
