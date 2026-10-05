// src/features/dashboard/components/ultimos-movimientos.tsx
import { Movimiento } from '../queries';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';
import { CATEGORIA_GASTO_LABELS } from '@/lib/constants';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';

export function UltimosMovimientos({ movimientos }: { movimientos: Movimiento[] }) {
    if (movimientos.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay movimientos registrados.</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Detalle</th>
                    <th className="pb-2 font-medium">Monto</th>
                </tr>
            </thead>
            <tbody>
                {movimientos.map((m) => (
                    <tr key={`${m.tipo}-${m.id}`} className="border-b last:border-0">
                        <td className="py-2">{formatDate(m.fecha)}</td>
                        <td className="py-2">
                            {m.tipo === 'INGRESO' ? (
                                <div className="flex items-center gap-2">
                                    <ClienteColorDot color={m.clienteColor} nombre={m.clienteNombre} />
                                    {m.clienteNombre}
                                </div>
                            ) : (
                                <div>
                                    <p>{m.descripcion}</p>
                                    <p className="text-xs text-muted-foreground">{CATEGORIA_GASTO_LABELS[m.categoria]}</p>
                                </div>
                            )}
                        </td>
                        <td className={`py-2 font-medium ${m.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                            {m.tipo === 'INGRESO' ? '+' : '-'} {formatCurrency(m.monto, m.moneda)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
