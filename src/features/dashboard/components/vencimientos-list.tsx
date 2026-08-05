// src/features/dashboard/components/vencimientos-list.tsx
import { ProximoVencimiento } from '../queries';
import { formatDate } from '@/lib/utils';
import { TIPO_SERVICIO_LABELS } from '@/lib/constants';

export function VencimientosList({ vencimientos }: { vencimientos: ProximoVencimiento[] }) {
    if (vencimientos.length === 0) {
        return <p className="text-sm text-muted-foreground">No hay vencimientos en los próximos 15 días.</p>;
    }

    return (
        <ul className="space-y-3">
            {vencimientos.map((v) => {
                const dias = Math.ceil(
                    (new Date(v.proximoVencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const vencido = dias < 0;

                return (
                    <li key={v.id} className="flex items-center justify-between text-sm">
                        <div>
                            <p className="font-medium">{v.clienteNombre}</p>
                            <p className="text-muted-foreground">
                                {v.tipo === 'OTRO' ? v.nombrePersonalizado : TIPO_SERVICIO_LABELS[v.tipo]} ·{' '}
                                {formatDate(v.proximoVencimiento)}
                            </p>
                        </div>
                        <span className={vencido ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            {vencido ? 'Vencido' : `${dias}d`}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}