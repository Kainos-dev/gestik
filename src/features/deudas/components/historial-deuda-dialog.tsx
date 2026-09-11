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

                {reposiciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no se registraron reposiciones.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Acreditado</TableHead>
                                <TableHead>Pagado</TableHead>
                                <TableHead>Cambio</TableHead>
                                <TableHead>Notas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reposiciones.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{formatDate(r.fecha)}</TableCell>
                                    <TableCell>{formatCurrency(r.monto, deuda.moneda)}</TableCell>
                                    <TableCell>{formatCurrency(r.montoPagado, r.monedaPago)}</TableCell>
                                    <TableCell>{r.tipoCambio ? r.tipoCambio : '—'}</TableCell>
                                    <TableCell className="max-w-48 truncate whitespace-normal text-muted-foreground">
                                        {r.notas || '—'}
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
