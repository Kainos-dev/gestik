// src/features/deudas/components/eliminar-deuda-dialog.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { eliminarDeuda } from '../actions';
import { Deuda } from '../types';
import { formatCurrency } from '@/lib/moneda';

// Confirmación en un diálogo propio (no un window.confirm) para que no se
// elimine nada con un Enter o un click de más: hay que tocar el botón rojo.
export function EliminarDeudaDialog({ deuda, cantidadReposiciones }: { deuda: Deuda; cantidadReposiciones: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    function confirmar() {
        startTransition(async () => {
            try {
                const resultado = await eliminarDeuda(deuda.id);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                }
                toast.success('Deuda eliminada. La podés recuperar desde "Eliminadas".');
                setOpen(false);
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al eliminar la deuda');
                console.error(error);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Eliminar deuda">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>¿Eliminar &quot;{deuda.descripcion}&quot;?</DialogTitle>
                    <DialogDescription>
                        {deuda.integranteNombre} · {formatCurrency(deuda.montoTotal, deuda.moneda)}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>La deuda deja de aparecer en la pestaña Deudas y en sus totales. No se borra: se puede recuperar desde la vista &quot;Eliminadas&quot;.</p>
                    {cantidadReposiciones > 0 && (
                        <p>
                            Sus {cantidadReposiciones} reposicion{cantidadReposiciones === 1 ? '' : 'es'} se conservan y siguen
                            descontándose de la cuenta en Balance Mensual y Gestión, porque esa plata ya salió.
                        </p>
                    )}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirmar} disabled={isPending}>
                        {isPending ? 'Eliminando...' : 'Eliminar deuda'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
