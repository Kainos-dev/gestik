// src/app/(dashboard)/dashboard/page.tsx
import { getDetalleKpis, getKpis } from '@/features/dashboard/queries';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { DetalleCobrado, DetalleFacturado, DetalleVencido } from '@/features/dashboard/components/kpi-detalle-listas';
import {
    getDisponibleEnMP,
    getMesesPendientesDeReparto,
    getRepartosMensuales,
} from '@/features/balance-mensual/queries';
import { BalanceMensualPanel } from '@/features/balance-mensual/components/balance-mensual-panel';
import { TipoCambioMensualGate } from '@/features/balance-mensual/components/tipo-cambio-mensual-gate';
import { formatCurrency } from '@/lib/moneda';

// "Septiembre 2026", "Octubre 2026", etc. — para que los paneles "de este
// mes" aclaren a qué mes se refieren en vez de depender de que quien lo mira
// sepa en qué fecha está parado el sistema.
function nombreMesActual(): string {
    const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date());
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export default async function DashboardPage() {
    const [kpis, detalle, mesesPendientesDeReparto, repartos, disponibleMP] = await Promise.all([
        getKpis(),
        getDetalleKpis(),
        getMesesPendientesDeReparto(),
        getRepartosMensuales(),
        getDisponibleEnMP(),
    ]);

    const mesActual = nombreMesActual();
    // Sólo bloquean los que tuvieron Facturado en USD (los de USD=0 se
    // generan solos vía cron, nunca deberían llegar a verse acá — pero por
    // las dudas se filtran igual).
    const mesesQueNecesitanTipoCambio = mesesPendientesDeReparto.filter((m) => m.facturadoUsd > 0);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Gestión</h1>

            <TipoCambioMensualGate mesesPendientes={mesesQueNecesitanTipoCambio} />

            {kpis.porMoneda.map((k) => (
                <div key={k.moneda} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiDetalleCard
                        label={
                            <>
                                Dinero que falta entrar este mes ({k.moneda})
                                <br />
                                <span className="italic font-normal text-muted-foreground">{mesActual}</span>
                            </>
                        }
                        value={formatCurrency(k.totalFacturadoMes, k.moneda)}
                        descripcion="Cargos que vencen este mes, descontando lo que ya se cobró antes de que arrancara el mes."
                    >
                        <DetalleFacturado cargos={detalle.cargosMes.filter((c) => c.moneda === k.moneda)} />
                    </KpiDetalleCard>
                    <KpiDetalleCard
                        label={
                            <>
                                Cobrado del mes ({k.moneda})
                                <br />
                                <span className="italic font-normal text-muted-foreground">{mesActual}</span>
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

            <BalanceMensualPanel repartos={repartos} disponibleMP={disponibleMP} />
        </div>
    );
}
