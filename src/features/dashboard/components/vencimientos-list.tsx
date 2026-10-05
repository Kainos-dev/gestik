// src/features/dashboard/components/vencimientos-list.tsx
import { ProximoVencimiento, ProximoVencimientoGasto } from '../queries';
import { formatDate } from '@/lib/utils';
import { TIPO_SERVICIO_LABELS, CATEGORIA_GASTO_LABELS } from '@/lib/constants';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';

// Cuántos días faltan hasta una fecha (negativo si ya pasó). Compartido por
// las dos columnas — planes de clientes y gastos fijos usan el mismo
// criterio de "vencido".
function diasHasta(fecha: Date): number {
    return Math.ceil((new Date(fecha).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

function DiasBadge({ dias }: { dias: number }) {
    const vencido = dias < 0;
    return (
        <span className={vencido ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
            {vencido ? 'Vencido' : `${dias}d`}
        </span>
    );
}

function ClientesVencimientos({ vencimientos }: { vencimientos: ProximoVencimiento[] }) {
    if (vencimientos.length === 0) {
        return <p className="text-sm text-muted-foreground">Ningún plan vence en los próximos 15 días.</p>;
    }

    return (
        <ul className="space-y-3">
            {vencimientos.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-medium flex items-center gap-2">
                            <ClienteColorDot color={v.clienteColor} nombre={v.clienteNombre} />
                            {v.clienteNombre}
                        </p>
                        <p className="text-muted-foreground">
                            {v.tipo === 'OTRO' ? v.nombrePersonalizado : TIPO_SERVICIO_LABELS[v.tipo]} ·{' '}
                            {formatDate(v.proximoVencimiento)}
                        </p>
                    </div>
                    <DiasBadge dias={diasHasta(v.proximoVencimiento)} />
                </li>
            ))}
        </ul>
    );
}

function GastosVencimientos({ vencimientos }: { vencimientos: ProximoVencimientoGasto[] }) {
    if (vencimientos.length === 0) {
        return <p className="text-sm text-muted-foreground">Ningún gasto fijo vence en los próximos 15 días.</p>;
    }

    return (
        <ul className="space-y-3">
            {vencimientos.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-medium">{v.nombre}</p>
                        <p className="text-muted-foreground">
                            {CATEGORIA_GASTO_LABELS[v.categoria]} · {formatDate(v.proximoVencimiento)}
                        </p>
                    </div>
                    <DiasBadge dias={diasHasta(v.proximoVencimiento)} />
                </li>
            ))}
        </ul>
    );
}

export function VencimientosList({
    vencimientosClientes,
    vencimientosGastos,
}: {
    vencimientosClientes: ProximoVencimiento[];
    vencimientosGastos: ProximoVencimientoGasto[];
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
                <div>
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">Renovación de servicios</h3>
                    <p className="text-xs text-muted-foreground">
                        Fin del período actual del servicio — ese día termina el mes/ciclo en curso y arranca el
                        siguiente.
                    </p>
                </div>
                <ClientesVencimientos vencimientos={vencimientosClientes} />
            </div>
            <div className="space-y-3">
                <div>
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">Gastos fijos</h3>
                    <p className="text-xs text-muted-foreground">Próxima fecha en que vuelve a cobrarse el gasto.</p>
                </div>
                <GastosVencimientos vencimientos={vencimientosGastos} />
            </div>
        </div>
    );
}
