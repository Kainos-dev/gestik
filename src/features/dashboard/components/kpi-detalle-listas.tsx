// src/features/dashboard/components/kpi-detalle-listas.tsx
import { CargoFacturadoMes } from '../queries';
import { calcularEstadoCargo } from '@/features/cargos/services';
import { SaldoCliente } from '@/features/cargos/queries';
import { Pago } from '@/features/pagos/types';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/moneda';
import { METODO_PAGO_LABELS, TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { StatusBadge } from '@/components/shared/status-badge';

function Vacio({ texto }: { texto: string }) {
    return <p className="text-sm text-muted-foreground">{texto}</p>;
}

function Cliente({ color, nombre }: { color?: string; nombre?: string }) {
    return (
        <div className="flex items-center gap-2">
            <ClienteColorDot color={color} nombre={nombre} />
            {nombre}
        </div>
    );
}

export function DetalleFacturado({ cargos }: { cargos: CargoFacturadoMes[] }) {
    if (cargos.length === 0) return <Vacio texto="No hay cargos este mes." />;

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Servicio</th>
                    <th className="pb-2 font-medium">Vence</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium text-right">Entra este mes</th>
                </tr>
            </thead>
            <tbody>
                {cargos.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2"><Cliente color={c.clienteColor} nombre={c.clienteNombre} /></td>
                        <td className="py-2">
                            {c.servicioNombrePersonalizado ||
                                TIPO_SERVICIO_LABELS[c.servicioTipo ?? ''] ||
                                c.servicioTipo}
                        </td>
                        <td className="py-2">{formatDate(c.vencimiento)}</td>
                        <td className="py-2">
                            <StatusBadge value={calcularEstadoCargo(c.monto, c.montoCubierto, c.vencimiento)} />
                        </td>
                        <td className="py-2 text-right">
                            {formatCurrency(c.contribucionMes, c.moneda)}
                            {c.montoCubiertoAntesDelMes > 0 && (
                                <p className="text-xs font-normal text-muted-foreground">
                                    de {formatCurrency(c.monto, c.moneda)} — ya se cobró{' '}
                                    {formatCurrency(c.montoCubiertoAntesDelMes, c.moneda)} antes de este mes
                                </p>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function DetalleCobrado({ pagos }: { pagos: Pago[] }) {
    if (pagos.length === 0) return <Vacio texto="Todavía no hay cobros este mes." />;

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Servicio</th>
                    <th className="pb-2 font-medium">Método</th>
                    <th className="pb-2 font-medium text-right">Monto</th>
                </tr>
            </thead>
            <tbody>
                {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{formatDate(p.fecha)}</td>
                        <td className="py-2"><Cliente color={p.clienteColor} nombre={p.clienteNombre} /></td>
                        <td className="py-2">
                            {p.servicioNombre ? TIPO_SERVICIO_LABELS[p.servicioNombre] ?? p.servicioNombre : '—'}
                        </td>
                        <td className="py-2">{METODO_PAGO_LABELS[p.metodoPago] ?? p.metodoPago}</td>
                        <td className="py-2 text-right">{formatCurrency(p.monto, p.moneda)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function DetalleVencido({ saldos }: { saldos: SaldoCliente[] }) {
    if (saldos.length === 0) return <Vacio texto="Ningún cliente tiene deuda vencida. 🎉" />;

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Cargos vencidos</th>
                    <th className="pb-2 font-medium text-right">Saldo vencido</th>
                </tr>
            </thead>
            <tbody>
                {saldos.map((s) => (
                    <tr key={`${s.clienteId}-${s.moneda}`} className="border-b last:border-0">
                        <td className="py-2"><Cliente color={s.clienteColor} nombre={s.clienteNombre} /></td>
                        <td className="py-2">{s.cantidadCargos}</td>
                        <td className="py-2 text-right">{formatCurrency(s.saldo, s.moneda)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
