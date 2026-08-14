// src/features/finanzas/components/ranking-clientes.tsx
import { IngresoCliente } from '../queries';
import { MONEDAS, formatCurrency } from '@/lib/moneda';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';

// El ranking se agrupa por moneda: un top-10 mezclando ARS y USD no se puede
// ordenar ni graficar con una sola barra de forma que tenga sentido (100 USD
// y 100.000 ARS no son comparables).
export function RankingClientes({ ingresos }: { ingresos: IngresoCliente[] }) {
    if (ingresos.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay pagos cobrados.</p>;
    }

    const grupos = MONEDAS.map((moneda) => ({
        moneda,
        items: ingresos.filter((i) => i.moneda === moneda),
    })).filter((g) => g.items.length > 0);

    return (
        <div className="space-y-5">
            {grupos.map((grupo) => {
                const max = Math.max(...grupo.items.map((i) => i.total));
                return (
                    <div key={grupo.moneda} className="space-y-3">
                        {grupos.length > 1 && (
                            <p className="text-xs font-medium text-muted-foreground">{grupo.moneda}</p>
                        )}
                        <ul className="space-y-3">
                            {grupo.items.map((c) => (
                                <li key={c.clienteId} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium flex items-center gap-2">
                                            <ClienteColorDot color={c.clienteColor} nombre={c.clienteNombre} />
                                            {c.clienteNombre}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatCurrency(c.total, c.moneda)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${(c.total / max) * 100}%`, backgroundColor: c.clienteColor }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}