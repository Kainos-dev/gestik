// src/features/balance-mensual/components/balance-mensual-panel.tsx
import { MovimientoSaldo, RepartoMensual } from '../types';
import type { SaldoEnPesos } from '../queries';
import type { PorcentajeSueldo } from '../services';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { GastosFijosDelMes } from '@/features/gastos/services';
import { DetalleGastosFijos } from '@/features/gastos/components/gastos-fijos-total';
import type { CotizacionVigente } from '@/lib/cotizacion-dolar';
import { formatCurrency } from '@/lib/moneda';
import { cn, formatDate } from '@/lib/utils';
import { TarjetaSaldo } from './tarjeta-saldo';
import { AccionesCuenta } from './movimiento-cuenta-dialog';
import { TarjetaSueldos } from './tarjeta-sueldos';

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

// Renglón del medio de Balance Mensual: dos tarjetas de la mitad del ancho
// cada una (apiladas en el celular).
// - Sueldos: el del último reparto cerrado (normalmente el mes pasado, se
//   genera el 1º del mes siguiente), con el porcentaje con que se calculó;
//   al tocarla se configura el porcentaje con vigencia (ver TarjetaSueldos).
// - Gastos Fijos: lo que suman por mes los gastos fijos activos de este mes,
//   todo en pesos (USD con el blue venta vigente, estimado) — mismo cálculo
//   que Gastos → Gastos fijos (calcularGastosFijosDelMes).
export function BalanceMensualPanel({
    repartos,
    porcentajesSueldo,
    gastosFijosDelMes,
    cotizacion,
}: {
    repartos: RepartoMensual[];
    porcentajesSueldo: PorcentajeSueldo[];
    gastosFijosDelMes: GastosFijosDelMes;
    cotizacion: CotizacionVigente | null;
}) {
    const ultimoReparto = repartos.length ? repartos[repartos.length - 1] : null;
    const faltaCotizacion = gastosFijosDelMes.usdSinConvertir > 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TarjetaSueldos reparto={ultimoReparto} porcentajes={porcentajesSueldo} />
            <KpiDetalleCard
                label="Gastos Fijos (por mes)"
                value={formatCurrency(gastosFijosDelMes.totalMensualArs, 'ARS') + (faltaCotizacion ? ' + USD sin cotización' : '')}
                descripcion="Gastos fijos activos de este mes, en pesos. Los que están en dólares se estiman con el dólar blue venta vigente y se actualizan solos con cada cotización; el monto original en USD no cambia. Los anuales se muestran pero no suman al total mensual."
            >
                <DetalleGastosFijos delMes={gastosFijosDelMes} cotizacion={cotizacion} />
            </KpiDetalleCard>
        </div>
    );
}
