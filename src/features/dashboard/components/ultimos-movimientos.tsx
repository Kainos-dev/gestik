// src/features/dashboard/components/ultimos-movimientos.tsx
import { Pago } from '@/features/pagos/types';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';

export function UltimosMovimientos({ pagos }: { pagos: Pago[] }) {
    if (pagos.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Monto</th>
                </tr>
            </thead>
            <tbody>
                {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{formatDate(p.fecha)}</td>
                        <td className="py-2">
                            <div className="flex items-center gap-2">
                                <ClienteColorDot color={p.clienteColor} nombre={p.clienteNombre} />
                                {p.clienteNombre}
                            </div>
                        </td>
                        <td className="py-2">{formatCurrency(p.monto, p.moneda)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}