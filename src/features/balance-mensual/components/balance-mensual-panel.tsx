// src/features/balance-mensual/components/balance-mensual-panel.tsx
import { Info } from 'lucide-react';
import { RepartoMensual } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { formatCurrency } from '@/lib/moneda';

const MESES_LARGOS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMesLargo(mes: Date): string {
    const f = new Date(mes);
    return `${MESES_LARGOS[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

// Una línea por moneda dentro de la misma tarjeta (mismo patrón que
// DeudasTotales en deudas/components/deudas-totales.tsx) — para no repetir
// "Sueldos (ARS)" / "Sueldos (USD)" como dos tarjetas separadas. Sueldos y
// Gastos fijos y deudas se quedan como "sólo el último mes" sin detalle: a
// diferencia del ahorro, esa plata se gasta/retira ese mismo mes (no se
// acumula), así que no hay mucho que auditar mes a mes ahí.
function TarjetaPorMoneda({
    label,
    descripcion,
    ars,
    usd,
}: {
    label: string;
    descripcion: string;
    ars: number;
    usd: number;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">{formatCurrency(ars, 'ARS')}</p>
                {usd > 0 && <p className="text-2xl font-semibold">{formatCurrency(usd, 'USD')}</p>}
                <p className="text-xs text-muted-foreground">{descripcion}</p>
            </CardContent>
        </Card>
    );
}

// Historial mes a mes del ahorro (detalle de la tarjeta "Ahorro") — a
// diferencia de Sueldos/Gastos fijos y deudas, el ahorro sí tiene sentido
// auditarlo en el tiempo: es la plata que se va juntando en las reservas de
// MP, no algo que se gasta/retira el mismo mes.
function DetalleAhorro({ repartos }: { repartos: RepartoMensual[] }) {
    const ordenados = [...repartos].sort((a, b) => new Date(b.mes).getTime() - new Date(a.mes).getTime());

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Mes</th>
                    <th className="pb-2 font-medium text-right">Facturado</th>
                    <th className="pb-2 font-medium text-right">Ahorro (50%)</th>
                </tr>
            </thead>
            <tbody>
                {ordenados.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2">{formatMesLargo(r.mes)}</td>
                        <td className="py-2 text-right text-muted-foreground">
                            {formatCurrency(r.facturadoArs, 'ARS')}
                            {r.facturadoUsd > 0 && <> · {formatCurrency(r.facturadoUsd, 'USD')}</>}
                        </td>
                        <td className="py-2 text-right font-medium">{formatCurrency(r.ahorroMesArs, 'ARS')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function TarjetaDisponibleMP({ value }: { value: number | null }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    Disponible en MP (aprox.)
                    <Tooltip>
                        <TooltipTrigger
                            aria-label="Cómo se calcula este número"
                            className="inline-flex cursor-help text-muted-foreground"
                        >
                            <Info className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        {/* align="end": esta tarjeta siempre queda última de
                            la fila (pegada al borde derecho) — centrado el
                            tooltip se salía de la pantalla. */}
                        <TooltipContent align="end">
                            Lo apartado para gastos fijos y deudas (20% en pesos de cada reparto mensual) menos lo
                            que ya se pagó en gastos fijos y en reposiciones de deuda en pesos desde el primer
                            reparto. Puede arrancar en negativo si ya se gastaba/pagaba deuda antes de usar este
                            sistema — no es el saldo real de la cuenta, es sólo un aproximado.
                        </TooltipContent>
                    </Tooltip>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold">{value !== null ? formatCurrency(value, 'ARS') : '—'}</div>
            </CardContent>
        </Card>
    );
}

export function BalanceMensualPanel({
    repartos,
    disponibleMP,
}: {
    repartos: RepartoMensual[];
    disponibleMP: number | null;
}) {
    if (repartos.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Sueldos, ahorro y gastos fijos</CardTitle>
                    <CardDescription>
                        Todavía no se generó ningún reparto mensual — el primero se genera el 1º del mes que viene,
                        a partir de lo Facturado este mes.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const ultimoReparto = repartos[repartos.length - 1];

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-medium">Sueldos, ahorro y gastos fijos</h2>
            <p className="text-sm text-muted-foreground">
                Reparto más reciente: {formatMesLargo(ultimoReparto.mes)} (30% sueldos / 50% ahorro / 20% gastos
                fijos y deudas sobre lo Facturado ese mes, aplicado el 1º del mes siguiente).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <TarjetaPorMoneda
                    label="Sueldos"
                    descripcion={`30% de lo Facturado en ${formatMesLargo(ultimoReparto.mes)}`}
                    ars={ultimoReparto.sueldosArs}
                    usd={ultimoReparto.sueldosUsd}
                />
                <TarjetaPorMoneda
                    label="Gastos fijos y deudas"
                    descripcion={`20% de lo Facturado en ${formatMesLargo(ultimoReparto.mes)}`}
                    ars={ultimoReparto.gastosDeudasArs}
                    usd={ultimoReparto.gastosDeudasUsd}
                />
                <KpiDetalleCard
                    label="Ahorro"
                    value={formatCurrency(ultimoReparto.ahorroMesArs, 'ARS')}
                    descripcion={`50% de lo Facturado en ${formatMesLargo(ultimoReparto.mes)} (ya convertido a pesos). Historial mes a mes:`}
                >
                    <DetalleAhorro repartos={repartos} />
                </KpiDetalleCard>
                <TarjetaDisponibleMP value={disponibleMP} />
            </div>
        </div>
    );
}
