// src/features/finanzas/components/ranking-clientes.tsx
import { IngresoCliente } from '../queries';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export function RankingClientes({ ingresos }: { ingresos: IngresoCliente[] }) {
    if (ingresos.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay pagos cobrados.</p>;
    }

    const max = Math.max(...ingresos.map((i) => i.total));

    return (
        <ul className="space-y-3">
            {ingresos.map((c) => (
                <li key={c.clienteId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.clienteNombre}</span>
                        <span className="text-muted-foreground">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(c.total / max) * 100}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}