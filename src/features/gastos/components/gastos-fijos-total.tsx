// src/features/gastos/components/gastos-fijos-total.tsx
import { GastosFijosDelMes } from '../services';
import type { CotizacionVigente } from '@/lib/cotizacion-dolar';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/moneda';
import { FRECUENCIA_GASTO_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

// Aviso común: cotización usada para los USD, o que falta y qué quedó afuera.
export function NotaCotizacionGastosFijos({
    delMes,
    cotizacion,
}: {
    delMes: GastosFijosDelMes;
    cotizacion: CotizacionVigente | null;
}) {
    const hayUsd = delMes.mensuales.some((g) => g.gastoFijo.moneda === 'USD');
    if (!hayUsd) return null;
    if (delMes.usdSinConvertir > 0) {
        return (
            <p className="text-xs text-amber-500">
                Sin cotización del dólar blue: {formatCurrency(delMes.usdSinConvertir, 'USD')} no se pudieron pasar a pesos y
                no están en el total.
            </p>
        );
    }
    return (
        <p className="text-xs text-muted-foreground">
            Los USD se estiman con el blue venta del {formatDate(`${cotizacion!.fecha}T12:00:00Z`)} (
            {formatCurrency(cotizacion!.venta, 'ARS')}).
        </p>
    );
}

// Franja compacta arriba de la lista de gastos fijos: cuánto suman por mes los
// gastos fijos activos, todo en pesos (los USD estimados con la cotización
// vigente), con el desglose por moneda original, los anuales aparte y la
// aclaración de la cotización — en un solo renglón en escritorio para que la
// lista gane alto. Mismo cálculo que la tarjeta "Gastos Fijos" de Balance
// Mensual (calcularGastosFijosDelMes).
export function GastosFijosTotal({
    delMes,
    cotizacion,
}: {
    delMes: GastosFijosDelMes;
    cotizacion: CotizacionVigente | null;
}) {
    const porMonedaConMonto = delMes.porMoneda.filter((t) => t.total > 0);
    const anualesArs = delMes.anuales.reduce((s, g) => s + (g.montoArs ?? 0), 0);

    return (
        <Card size="sm" className="py-3">
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
                <div className="shrink-0">
                    <p className="text-xs font-medium text-muted-foreground">Total de gastos fijos por mes</p>
                    {delMes.mensuales.length ? (
                        <p className="text-2xl font-semibold tracking-tight">
                            {formatCurrency(delMes.totalMensualArs, 'ARS')}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">ARS</span>
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No hay gastos fijos mensuales activos.</p>
                    )}
                </div>

                {(porMonedaConMonto.length > 1 || delMes.anuales.length > 0) && (
                    <div className="space-y-0.5 text-sm text-muted-foreground sm:border-l sm:pl-6">
                        {porMonedaConMonto.length > 1 && (
                            <p>{porMonedaConMonto.map((t) => formatCurrency(t.total, t.moneda)).join(' + ')}</p>
                        )}
                        {delMes.anuales.length > 0 && <p>Más gastos anuales: {formatCurrency(anualesArs, 'ARS')} por año</p>}
                    </div>
                )}

                <div className="sm:ml-auto sm:max-w-sm sm:text-right">
                    <NotaCotizacionGastosFijos delMes={delMes} cotizacion={cotizacion} />
                </div>
            </CardContent>
        </Card>
    );
}

// Detalle (modal de Balance Mensual → Gastos Fijos): cada gasto fijo del mes
// con su monto original y el equivalente en pesos.
export function DetalleGastosFijos({
    delMes,
    cotizacion,
}: {
    delMes: GastosFijosDelMes;
    cotizacion: CotizacionVigente | null;
}) {
    if (delMes.mensuales.length === 0 && delMes.anuales.length === 0) {
        return <p className="text-sm text-muted-foreground">No hay gastos fijos activos este mes.</p>;
    }
    const filas = [...delMes.mensuales, ...delMes.anuales];
    return (
        <div className="space-y-2">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2 font-medium">Gasto fijo</th>
                        <th className="pb-2 font-medium">Frecuencia</th>
                        <th className="pb-2 font-medium text-right">Monto</th>
                        <th className="pb-2 font-medium text-right">En pesos</th>
                    </tr>
                </thead>
                <tbody>
                    {filas.map(({ gastoFijo: g, montoArs }) => (
                        <tr key={g.id} className="border-b last:border-0">
                            <td className="py-2">{g.nombre}</td>
                            <td className="py-2 text-muted-foreground">
                                {FRECUENCIA_GASTO_LABELS[g.frecuencia]}
                                {g.frecuencia === 'ANUAL' && <p className="text-xs">no suma al total mensual</p>}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">{formatCurrency(g.monto, g.moneda)}</td>
                            <td className="py-2 text-right whitespace-nowrap font-medium">
                                {montoArs !== null ? (
                                    <>
                                        {g.moneda === 'USD' && '≈ '}
                                        {formatCurrency(montoArs, 'ARS')}
                                    </>
                                ) : (
                                    <span className="text-amber-500">Sin cotización</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <NotaCotizacionGastosFijos delMes={delMes} cotizacion={cotizacion} />
        </div>
    );
}
