// src/app/(dashboard)/dashboard/page.tsx
import {
    CargoFacturadoMes,
    getCargosFacturadoMes,
    getCargosProyectadosMes,
    getDetalleKpis,
    getKpis,
} from '@/features/dashboard/queries';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { DetalleCobrado, DetalleFacturado, DetalleVencido } from '@/features/dashboard/components/kpi-detalle-listas';
import {
    getDisponibleEnCuenta,
    getMovimientosAhorro,
    getMovimientosCuenta,
    getMesesPendientesDeReparto,
    getRepartosMensuales,
} from '@/features/balance-mensual/queries';
import { BalanceMensualPanel, SaldosCuentaYAhorro } from '@/features/balance-mensual/components/balance-mensual-panel';
import { TipoCambioMensualGate } from '@/features/balance-mensual/components/tipo-cambio-mensual-gate';
import { MONEDAS, Moneda, formatCurrency } from '@/lib/moneda';

// "Octubre 2026", etc. — los títulos de las tarjetas nombran el mes en vez
// de decir "este mes", para no depender de que quien lo mira sepa en qué
// fecha está parado el sistema. En UTC, igual que los meses que se le pasan
// a getCargosFacturadoMes (ver dateToSqlDateString).
function nombreMes(mes: Date): string {
    const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(mes);
    return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} ${mes.getUTCFullYear()}`;
}

function totalDeMoneda(cargos: CargoFacturadoMes[], moneda: Moneda): number {
    return cargos.filter((c) => c.moneda === moneda).reduce((total, c) => total + c.contribucionMes, 0);
}

export default async function DashboardPage() {
    const hoy = new Date();
    const mesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesAnterior = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
    const mesSiguiente = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));

    const [
        kpis,
        detalle,
        cargosMesAnterior,
        cargosMesSiguiente,
        cargosProyectadosMesSiguiente,
        mesesPendientesDeReparto,
        repartos,
        disponibleEnCuenta,
        movimientosCuenta,
        movimientosAhorro,
    ] = await Promise.all([
        getKpis(),
        getDetalleKpis(),
        getCargosFacturadoMes(mesAnterior),
        getCargosFacturadoMes(mesSiguiente),
        getCargosProyectadosMes(mesSiguiente),
        getMesesPendientesDeReparto(),
        getRepartosMensuales(),
        getDisponibleEnCuenta(),
        getMovimientosCuenta(),
        getMovimientosAhorro(),
    ]);

    // "Va a ingresar" = cargos que ya existen y vencen el mes que viene, más
    // los de clientes ANTICIPADO que todavía no se generaron (ver
    // getCargosProyectadosMes).
    const cargosVanAIngresar = [...cargosMesSiguiente, ...cargosProyectadosMesSiguiente];

    // Sólo bloquean los que tuvieron Facturado en USD (los de USD=0 se
    // generan solos vía cron, nunca deberían llegar a verse acá — pero por
    // las dudas se filtran igual).
    const mesesQueNecesitanTipoCambio = mesesPendientesDeReparto.filter((m) => m.facturadoUsd > 0);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Balance Mensual</h1>

            <TipoCambioMensualGate mesesPendientes={mesesQueNecesitanTipoCambio} />

            {MONEDAS.map((moneda) => {
                const k = kpis.porMoneda.find((p) => p.moneda === moneda);
                return (
                    <div key={moneda} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <KpiDetalleCard
                            label={
                                <>
                                    Dinero que ingresa en {nombreMes(mesActual)}
                                    <br />
                                    <span className="font-normal text-muted-foreground">{moneda}</span>
                                </>
                            }
                            value={formatCurrency(k?.totalFacturadoMes ?? 0, moneda)}
                            descripcion="Cargos que vencen este mes, descontando lo que ya se cobró antes de que arrancara el mes."
                        >
                            <DetalleFacturado cargos={detalle.cargosMes.filter((c) => c.moneda === moneda)} />
                        </KpiDetalleCard>
                        <KpiDetalleCard
                            label={
                                <>
                                    Dinero que ingresó en {nombreMes(mesAnterior)}
                                    <br />
                                    <span className="font-normal text-muted-foreground">{moneda}</span>
                                </>
                            }
                            value={formatCurrency(totalDeMoneda(cargosMesAnterior, moneda), moneda)}
                            descripcion="Cargos que vencían el mes pasado, descontando lo que ya se había cobrado antes de que arrancara ese mes. Es la base del reparto de sueldo, gastos y ahorro."
                        >
                            <DetalleFacturado cargos={cargosMesAnterior.filter((c) => c.moneda === moneda)} />
                        </KpiDetalleCard>
                        <KpiDetalleCard
                            label={
                                <>
                                    Dinero que va a ingresar en {nombreMes(mesSiguiente)}
                                    <br />
                                    <span className="font-normal text-muted-foreground">{moneda}</span>
                                </>
                            }
                            value={formatCurrency(totalDeMoneda(cargosVanAIngresar, moneda), moneda)}
                            descripcion="Cargos que vencen el mes que viene, descontando lo que ya se cobró. Incluye los de clientes con pago anticipado que todavía no se generaron (se generan el día que vencen)."
                        >
                            <DetalleFacturado cargos={cargosVanAIngresar.filter((c) => c.moneda === moneda)} />
                        </KpiDetalleCard>
                    </div>
                );
            })}

            <BalanceMensualPanel repartos={repartos} />

            <SaldosCuentaYAhorro
                disponible={disponibleEnCuenta}
                repartos={repartos}
                movimientosCuenta={movimientosCuenta}
                movimientosAhorro={movimientosAhorro}
            />

            <div className="space-y-4 pt-2">
                <h2 className="text-lg font-medium">Otros indicadores</h2>
                {kpis.porMoneda.map((k) => (
                    <div key={k.moneda} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <KpiDetalleCard
                            label={
                                <>
                                    Cobrado del mes ({k.moneda})
                                    <br />
                                    <span className="italic font-normal text-muted-foreground">
                                        {nombreMes(mesActual)}
                                    </span>
                                </>
                            }
                            value={formatCurrency(k.totalCobradoMes, k.moneda)}
                            descripcion="Pagos recibidos este mes."
                        >
                            <DetalleCobrado pagos={detalle.pagosMes.filter((p) => p.moneda === k.moneda)} />
                        </KpiDetalleCard>
                        <KpiDetalleCard
                            label={`Pagos que no realizaron los clientes (${k.moneda})`}
                            value={formatCurrency(k.totalVencido, k.moneda)}
                            descripcion="Cargos cuyo vencimiento ya pasó y todavía no se cubrieron del todo."
                        >
                            <DetalleVencido saldos={detalle.saldosVencidos.filter((s) => s.moneda === k.moneda)} />
                        </KpiDetalleCard>
                    </div>
                ))}
            </div>
        </div>
    );
}
