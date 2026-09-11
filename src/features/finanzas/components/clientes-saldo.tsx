// src/features/finanzas/components/clientes-saldo.tsx
import { ClienteSaldoCargos } from '../queries';
import { Badge } from '@/components/ui/badge';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { formatCurrency } from '@/lib/moneda';

interface ClientesSaldoProps {
    clientes: ClienteSaldoCargos[];
    emptyMessage: string;
    badgeClassName: string;
    cargoLabel: string; // "vencido" o "pendiente"
}

export function ClientesSaldo({ clientes, emptyMessage, badgeClassName, cargoLabel }: ClientesSaldoProps) {
    if (clientes.length === 0) {
        return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
        <ul className="space-y-3">
            {clientes.map((c) => (
                // clienteId + moneda: un mismo cliente puede tener saldo en ARS y en USD a la vez
                <li key={`${c.clienteId}:${c.moneda}`} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-medium flex items-center gap-2">
                            <ClienteColorDot color={c.clienteColor} nombre={c.clienteNombre} />
                            {c.clienteNombre}
                        </p>
                        <p className="text-muted-foreground">
                            {c.cantidadCargos} cargo{c.cantidadCargos !== 1 ? 's' : ''} {cargoLabel}
                            {c.cantidadCargos !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Badge variant="outline" className={badgeClassName}>
                        {formatCurrency(c.monto, c.moneda)}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}
