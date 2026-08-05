// src/features/dashboard/components/ultimos-movimientos.tsx
import { Pago } from '@/features/pagos/types';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/status-badge';
import { calcularEstadoMostrado } from '@/features/pagos/services';

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
                    <th className="pb-2 font-medium">Estado</th>
                </tr>
            </thead>
            <tbody>
                {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{formatDate(p.fecha)}</td>
                        <td className="py-2">{p.clienteNombre}</td>
                        <td className="py-2">
                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.monto)}
                        </td>
                        <td className="py-2">
                            <StatusBadge value={calcularEstadoMostrado(p.estado, p.fecha)} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}