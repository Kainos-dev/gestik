// src/features/finanzas/components/clientes-deuda.tsx
import { ClienteConDeuda } from '../queries';
import { Badge } from '@/components/ui/badge';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export function ClientesDeuda({ clientes }: { clientes: ClienteConDeuda[] }) {
    if (clientes.length === 0) {
        return <p className="text-sm text-muted-foreground">Ningún cliente tiene deuda pendiente. 🎉</p>;
    }

    return (
        <ul className="space-y-3">
            {clientes.map((c) => (
                <li key={c.clienteId} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-medium">{c.clienteNombre}</p>
                        <p className="text-muted-foreground">
                            {c.cantidadPagos} pago{c.cantidadPagos > 1 ? 's' : ''} pendiente{c.cantidadPagos > 1 ? 's' : ''}
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">
                        {formatCurrency(c.deuda)}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}