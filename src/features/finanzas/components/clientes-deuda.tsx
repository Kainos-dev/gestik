// src/features/finanzas/components/clientes-deuda.tsx
import { ClienteConDeuda } from '../queries';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/moneda';

export function ClientesDeuda({ clientes }: { clientes: ClienteConDeuda[] }) {
    if (clientes.length === 0) {
        return <p className="text-sm text-muted-foreground">Ningún cliente tiene deuda pendiente. 🎉</p>;
    }

    return (
        <ul className="space-y-3">
            {clientes.map((c) => (
                // clienteId + moneda: un mismo cliente puede tener deuda en ARS y en USD a la vez
                <li key={`${c.clienteId}:${c.moneda}`} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-medium">{c.clienteNombre}</p>
                        <p className="text-muted-foreground">
                            {c.cantidadCargos} cargo{c.cantidadCargos !== 1 ? 's' : ''} pendiente{c.cantidadCargos !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">
                        {formatCurrency(c.deuda, c.moneda)}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}