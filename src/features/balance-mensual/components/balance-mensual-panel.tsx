// src/features/balance-mensual/components/balance-mensual-panel.tsx
import { MovimientoSaldo, RepartoMensual } from '../types';
import type { SaldoEnPesos } from '../queries';
import { PORCENTAJE_AHORRO, PORCENTAJE_GASTOS_DEUDAS, PORCENTAJE_SUELDOS } from '../services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { formatCurrency } from '@/lib/moneda';
import { cn, formatDate } from '@/lib/utils';
import { TarjetaSaldo } from './tarjeta-saldo';
import { AccionesCuenta } from './movimiento-cuenta-dialog';
import { Badge } from '@/components/ui/badge';
import type { ReactNode } from 'react';

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

// Sueldo es un monto fijo; Gastos y Ahorro son estimados: hoy el 30% de
// gastos se usa entero para gastos fijos y deudas, pero si mañana sobra, esa
// diferencia cambia lo que realmente queda para gastos y para ahorro.
function TituloReparto({ texto, tipo }: { texto: string; tipo: 'FIJO' | 'ESTIMADO' }) {
    return (
        <span className="flex flex-wrap items-center gap-2">
            {texto}
            <Badge variant={tipo === 'FIJO' ? 'default' : 'outline'}>{tipo === 'FIJO' ? 'Fijo' : 'Estimado'}</Badge>
        </span>
    );
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
    label: ReactNode;
    descripcion: string;
    ars: number;
    usd: number;
}) {
    return (
        <Card size="sm" className="h-full gap-2">
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto space-y-0.5">
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
                            {formatCurrency(r.facturadoArs + r.facturadoUsdEnArs, 'ARS')}
                            {r.facturadoUsd > 0 && (
                                <p className="text-xs">incluye {formatCurrency(r.facturadoUsd, 'USD')} pasados a pesos</p>
                            )}
                        </td>
                        <td className="py-2 text-right font-medium">{formatCurrency(r.ahorroMesArs, 'ARS')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// Historial (modal) de "Plata disponible en cuenta" / "Caja de ahorro":
// fecha, nombre del movimiento, cuánto entró o salió y en cuánto dejó la
// cuenta (ver getMovimientosCuenta/getMovimientosAhorro en queries.ts).
function MovimientosTabla({ movimientos }: { movimientos: MovimientoSaldo[] }) {
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
                            {m.nombre}
                            <p className="text-xs text-muted-foreground">{TIPO_MOVIMIENTO_LABELS[m.tipo]}</p>
                        </td>
                        <td
                            className={cn(
                                'py-2 text-right whitespace-nowrap',
                                m.montoOriginal >= 0 ? 'text-green-500' : 'text-red-500'
                            )}
                        >
                            {m.monto === null ? (
                                <span className="text-muted-foreground">Sin cotización</span>
                            ) : (
                                <>
                                    {m.monto >= 0 ? '+' : ''}
                                    {formatCurrency(m.monto, 'ARS')}
                                </>
                            )}
                            {/* Pagado en dólares: cuánto fue y con qué blue venta se pasó a pesos. */}
                            {m.monedaOriginal === 'USD' && (
                                <p className="text-xs font-normal text-muted-foreground">
                                    {formatCurrency(Math.abs(m.montoOriginal), 'USD')}
                                    {m.tipoCambio !== null && <> × {formatCurrency(m.tipoCambio, 'ARS')}</>}
                                </p>
                            )}
                        </td>
                        <td className="py-2 text-right font-medium whitespace-nowrap">
                            {formatCurrency(m.saldo, 'ARS')}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const TIPO_MOVIMIENTO_LABELS: Record<MovimientoSaldo['tipo'], string> = {
    SALDO_INICIAL: 'Saldo inicial',
    INGRESO: 'Ingreso manual',
    RETIRO: 'Retiro manual',
    PAGO: 'Pago de cliente',
    GASTO_FIJO: 'Gasto fijo',
    GASTO: 'Gasto suelto',
    REPOSICION_DEUDA: 'Reposición de deuda',
};

function ValorSaldo({ saldo }: { saldo: SaldoEnPesos | null }) {
    return (
        <>
            <p className="text-3xl font-semibold lg:text-4xl">{saldo !== null ? formatCurrency(saldo.total, 'ARS') : '—'}</p>
            {saldo?.faltaCotizacion && (
                <p className="text-xs text-amber-500">
                    Hay movimientos en dólares sin cotización guardada que no se están contando.
                </p>
            )}
        </>
    );
}

export function SaldosCuentaYAhorro({
    disponible,
    cajaDeAhorro,
    movimientosCuenta,
    movimientosAhorro,
}: {
    disponible: SaldoEnPesos | null;
    cajaDeAhorro: SaldoEnPesos | null;
    movimientosCuenta: MovimientoSaldo[];
    movimientosAhorro: MovimientoSaldo[];
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TarjetaSaldo
                titulo="Plata disponible en cuenta"
                align="start"
                explicacion="Arranca en el saldo inicial y suma cada pago de un cliente y cada ingreso manual. Resta los gastos pagados con la cuenta (los gastos fijos, siempre), las reposiciones de deuda y los retiros manuales. Lo que entra o sale en dólares se pasa a pesos con el dólar blue venta del día."
                detalle={<MovimientosTabla movimientos={movimientosCuenta} />}
                acciones={<AccionesCuenta cuenta="CUENTA" />}
            >
                <ValorSaldo saldo={disponible} />
                <p className="text-sm text-muted-foreground">
                    Sube con cada pago de un cliente y baja con cada gasto pagado con la cuenta y cada deuda repuesta.
                </p>
            </TarjetaSaldo>
            <TarjetaSaldo
                titulo="Caja de ahorro"
                align="end"
                explicacion="Se carga a mano: arranca en el saldo inicial, suma cada ingreso y resta cada retiro y los gastos pagados con la caja de ahorro."
                detalle={<MovimientosTabla movimientos={movimientosAhorro} />}
                acciones={<AccionesCuenta cuenta="CAJA_AHORRO" />}
            >
                <ValorSaldo saldo={cajaDeAhorro} />
                <p className="text-sm text-muted-foreground">
                    Sube con cada ingreso a la caja y baja con cada retiro o gasto pagado con la caja.
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TarjetaPorMoneda
                label={<TituloReparto texto={`Sueldo (${porcentaje(PORCENTAJE_SUELDOS)} de los ingresos de ${mes})`} tipo="FIJO" />}
                descripcion={`Monto fijo, calculado sobre lo Facturado en ${formatMesLargo(ultimoReparto.mes)}.`}
                ars={ultimoReparto.sueldosArs}
                usd={ultimoReparto.sueldosUsd}
            />
            <TarjetaPorMoneda
                label={<TituloReparto texto={`Gastos (${porcentaje(PORCENTAJE_GASTOS_DEUDAS)} de los ingresos de ${mes})`} tipo="ESTIMADO" />}
                descripcion="Estimado: para gastos fijos y reposiciones de deuda. Si sobra, puede cambiar."
                ars={ultimoReparto.gastosDeudasArs}
                usd={ultimoReparto.gastosDeudasUsd}
            />
            <KpiDetalleCard
                label={<TituloReparto texto={`Ahorro (${porcentaje(PORCENTAJE_AHORRO)} de los ingresos de ${mes})`} tipo="ESTIMADO" />}
                value={formatCurrency(ultimoReparto.ahorroMesArs, 'ARS')}
                descripcion={`Estimado: ${porcentaje(PORCENTAJE_AHORRO)} de lo Facturado en ${formatMesLargo(ultimoReparto.mes)} (ya convertido a pesos). Puede cambiar según lo que sobre de gastos. Historial mes a mes:`}
            >
                <DetalleAhorro repartos={repartos} />
            </KpiDetalleCard>
        </div>
    );
}
