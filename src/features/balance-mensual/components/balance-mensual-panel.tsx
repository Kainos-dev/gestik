// src/features/balance-mensual/components/balance-mensual-panel.tsx
import { MovimientoSaldo, RepartoMensual } from '../types';
import type { DisponibleEnCuenta } from '../queries';
import { PORCENTAJE_AHORRO, PORCENTAJE_GASTOS_DEUDAS, PORCENTAJE_SUELDOS } from '../services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { formatCurrency } from '@/lib/moneda';
import { cn, formatDate } from '@/lib/utils';
import { TarjetaSaldo } from './tarjeta-saldo';

const MESES_LARGOS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMesLargo(mes: Date): string {
    const f = new Date(mes);
    return `${MESES_LARGOS[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

// Sólo el nombre del mes, sin año — es lo que piden los títulos de las
// tarjetas del reparto ("30% de los ingresos de Septiembre").
function formatNombreMes(mes: Date): string {
    return MESES_LARGOS[new Date(mes).getUTCMonth()];
}

function porcentaje(p: number): string {
    return `${Math.round(p * 100)}%`;
}

// Una línea por moneda dentro de la misma tarjeta (mismo patrón que
// DeudasTotales en deudas/components/deudas-totales.tsx) — para no repetir
// "Sueldo (ARS)" / "Sueldo (USD)" como dos tarjetas separadas. Sueldo y
// Gastos se quedan como "sólo el último mes" sin detalle: a diferencia del
// ahorro, esa plata se gasta/retira ese mismo mes (no se acumula), así que
// no hay mucho que auditar mes a mes ahí.
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
// diferencia de Sueldo/Gastos, el ahorro sí tiene sentido auditarlo en el
// tiempo: es la plata que se va juntando en las reservas de MP, no algo que
// se gasta/retira el mismo mes.
function DetalleAhorro({ repartos }: { repartos: RepartoMensual[] }) {
    const ordenados = [...repartos].sort((a, b) => new Date(b.mes).getTime() - new Date(a.mes).getTime());

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Mes</th>
                    <th className="pb-2 font-medium text-right">Facturado</th>
                    <th className="pb-2 font-medium text-right">Ahorro ({porcentaje(PORCENTAJE_AHORRO)})</th>
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

const NOMBRE_DEL_REPARTO: Record<'CUENTA' | 'AHORRO', string> = {
    CUENTA: `${porcentaje(PORCENTAJE_GASTOS_DEUDAS)} de gastos`,
    AHORRO: `${porcentaje(PORCENTAJE_AHORRO)} de ahorro`,
};

// Historial (modal) de "Plata disponible en cuenta" / "Caja de ahorro":
// fecha, nombre del movimiento, cuánto entró o salió y en cuánto dejó la
// cuenta (ver getMovimientosCuenta/getMovimientosAhorro en queries.ts).
function MovimientosTabla({
    movimientos,
    cuenta,
}: {
    movimientos: MovimientoSaldo[];
    cuenta: 'CUENTA' | 'AHORRO';
}) {
    if (movimientos.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Movimiento</th>
                    <th className="pb-2 font-medium text-right">Monto</th>
                    <th className="pb-2 font-medium text-right">Saldo</th>
                </tr>
            </thead>
            <tbody>
                {movimientos.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 whitespace-nowrap">{formatDate(m.fecha)}</td>
                        <td className="py-2">
                            {m.tipo === 'REPARTO' && m.mesReparto
                                ? `${NOMBRE_DEL_REPARTO[cuenta]} de ${formatMesLargo(m.mesReparto)}`
                                : m.nombre}
                            <p className="text-xs text-muted-foreground">{TIPO_MOVIMIENTO_LABELS[m.tipo]}</p>
                        </td>
                        <td
                            className={cn(
                                'py-2 text-right whitespace-nowrap',
                                m.monto >= 0 ? 'text-green-500' : 'text-red-500'
                            )}
                        >
                            {m.monto >= 0 ? '+' : ''}
                            {formatCurrency(m.monto, m.moneda)}
                        </td>
                        <td className="py-2 text-right font-medium whitespace-nowrap">
                            {formatCurrency(m.saldo, m.moneda)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const TIPO_MOVIMIENTO_LABELS: Record<MovimientoSaldo['tipo'], string> = {
    REPARTO: 'Reparto mensual',
    GASTO_FIJO: 'Gasto fijo',
    REPOSICION_DEUDA: 'Reposición de deuda',
};

export function SaldosCuentaYAhorro({
    disponible,
    repartos,
    movimientosCuenta,
    movimientosAhorro,
}: {
    disponible: DisponibleEnCuenta | null;
    repartos: RepartoMensual[];
    movimientosCuenta: MovimientoSaldo[];
    movimientosAhorro: MovimientoSaldo[];
}) {
    const ahorroTotal = repartos.reduce((total, r) => total + r.ahorroMesArs, 0);
    const ultimoReparto = repartos.at(-1);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TarjetaSaldo
                titulo="Plata disponible en cuenta"
                align="start"
                explicacion={`Suma el ${porcentaje(PORCENTAJE_GASTOS_DEUDAS)} de gastos de cada reparto mensual (sueldos y ahorro no van a esta cuenta) y resta lo pagado en gastos fijos y en reposiciones de deuda desde el primer reparto. Los gastos sueltos no se descuentan. Puede dar negativo si ya se pagaban gastos o deudas antes de usar este sistema — es un aproximado, no el saldo real de la cuenta.`}
                detalle={<MovimientosTabla movimientos={movimientosCuenta} cuenta="CUENTA" />}
            >
                {disponible === null ? (
                    <p className="text-4xl font-semibold">—</p>
                ) : (
                    <>
                        <p className="text-4xl font-semibold">{formatCurrency(disponible.ars, 'ARS')}</p>
                        {disponible.usd !== 0 && (
                            <p className="text-4xl font-semibold">{formatCurrency(disponible.usd, 'USD')}</p>
                        )}
                    </>
                )}
                <p className="text-sm text-muted-foreground">Baja sola cuando se paga un gasto fijo o una deuda.</p>
            </TarjetaSaldo>
            <TarjetaSaldo
                titulo="Caja de ahorro"
                align="end"
                explicacion={`Suma del ${porcentaje(PORCENTAJE_AHORRO)} de ahorro de todos los repartos mensuales, en pesos (lo que se fue facturando en USD se convierte con el tipo de cambio de cada mes).`}
                detalle={<MovimientosTabla movimientos={movimientosAhorro} cuenta="AHORRO" />}
            >
                <p className="text-4xl font-semibold">{formatCurrency(ahorroTotal, 'ARS')}</p>
                <p className="text-sm text-muted-foreground">
                    {ultimoReparto
                        ? `Último aporte: ${formatCurrency(ultimoReparto.ahorroMesArs, 'ARS')} (${formatMesLargo(ultimoReparto.mes)}).`
                        : 'Todavía no se generó ningún reparto mensual.'}
                </p>
            </TarjetaSaldo>
        </div>
    );
}

// Sueldo / Gastos / Ahorro del último reparto generado (normalmente el del
// mes pasado — se genera el 1º del mes siguiente, ver
// renovar-repartos-mensuales).
export function BalanceMensualPanel({ repartos }: { repartos: RepartoMensual[] }) {
    if (repartos.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Sueldo, gastos y ahorro</CardTitle>
                    <CardDescription>
                        Todavía no se generó ningún reparto mensual — el primero se genera el 1º del mes que viene,
                        a partir de lo Facturado este mes.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const ultimoReparto = repartos[repartos.length - 1];
    const mes = formatNombreMes(ultimoReparto.mes);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TarjetaPorMoneda
                label={`Sueldo (${porcentaje(PORCENTAJE_SUELDOS)} de los ingresos de ${mes})`}
                descripcion={`Calculado sobre lo Facturado en ${formatMesLargo(ultimoReparto.mes)}.`}
                ars={ultimoReparto.sueldosArs}
                usd={ultimoReparto.sueldosUsd}
            />
            <TarjetaPorMoneda
                label={`Gastos (${porcentaje(PORCENTAJE_GASTOS_DEUDAS)} de los ingresos de ${mes})`}
                descripcion="Para gastos fijos y reposiciones de deuda."
                ars={ultimoReparto.gastosDeudasArs}
                usd={ultimoReparto.gastosDeudasUsd}
            />
            <KpiDetalleCard
                label={`Ahorro (${porcentaje(PORCENTAJE_AHORRO)} de los ingresos de ${mes})`}
                value={formatCurrency(ultimoReparto.ahorroMesArs, 'ARS')}
                descripcion={`${porcentaje(PORCENTAJE_AHORRO)} de lo Facturado en ${formatMesLargo(ultimoReparto.mes)} (ya convertido a pesos). Historial mes a mes:`}
            >
                <DetalleAhorro repartos={repartos} />
            </KpiDetalleCard>
        </div>
    );
}
