// src/app/(dashboard)/dashboard/page.tsx
import { getIngresosPorCliente, getClientesPorEstadoCargo } from '@/features/finanzas/queries';
import { RankingClientes } from '@/features/finanzas/components/ranking-clientes';
import { ClientesSaldo } from '@/features/finanzas/components/clientes-saldo';
import { getDetalleKpis, getKpis, getProximosVencimientos, getUltimosMovimientos } from '@/features/dashboard/queries';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { DetalleCobrado, DetalleFacturado, DetallePendiente } from '@/features/dashboard/components/kpi-detalle-listas';
import { VencimientosList } from '@/features/dashboard/components/vencimientos-list';
import { UltimosMovimientos } from '@/features/dashboard/components/ultimos-movimientos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/moneda';

export default async function DashboardPage() {
    const [kpis, vencimientos, movimientos, detalle, ingresosPorCliente, clientesPorEstadoCargo] = await Promise.all([
        getKpis(),
        getProximosVencimientos(),
        getUltimosMovimientos(),
        getDetalleKpis(),
        getIngresosPorCliente(),
        getClientesPorEstadoCargo(),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>

            {kpis.porMoneda.map((k) => (
                <div key={k.moneda} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiDetalleCard
                        label={`Dinero que debería entrar este mes (${k.moneda})`}
                        value={formatCurrency(k.totalFacturadoMes, k.moneda)}
                        descripcion="Cargos generados este mes."
                    >
                        <DetalleFacturado cargos={detalle.cargosMes.filter((c) => c.moneda === k.moneda)} />
                    </KpiDetalleCard>
                    <KpiDetalleCard
                        label={`Cobrado del mes (${k.moneda})`}
                        value={formatCurrency(k.totalCobradoMes, k.moneda)}
                        descripcion="Pagos recibidos este mes."
                    >
                        <DetalleCobrado pagos={detalle.pagosMes.filter((p) => p.moneda === k.moneda)} />
                    </KpiDetalleCard>
                    <KpiDetalleCard
                        label={`Pendiente (${k.moneda})`}
                        value={formatCurrency(k.totalPendiente, k.moneda)}
                        descripcion="Saldo que debe cada cliente (todos los cargos menos todos los pagos)."
                    >
                        <DetallePendiente saldos={detalle.saldosPendientes.filter((s) => s.moneda === k.moneda)} />
                    </KpiDetalleCard>
                </div>
            ))}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                <KpiCard label="Clientes activos" value={String(kpis.clientesActivos)} />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ingresos por cliente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RankingClientes ingresos={ingresosPorCliente} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Clientes con deuda</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ClientesSaldo
                            clientes={clientesPorEstadoCargo.conDeuda}
                            emptyMessage="Ningún cliente tiene deuda vencida. 🎉"
                            badgeClassName="bg-red-50 text-red-700 border-red-200 font-medium"
                            cargoLabel="vencido"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Clientes con pagos pendientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ClientesSaldo
                            clientes={clientesPorEstadoCargo.conPagosPendientes}
                            emptyMessage="Nadie tiene pagos pendientes dentro de plazo."
                            badgeClassName="bg-amber-50 text-amber-700 border-amber-200 font-medium"
                            cargoLabel="pendiente"
                        />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Próximos vencimientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VencimientosList vencimientos={vencimientos} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Últimos movimientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <UltimosMovimientos pagos={movimientos} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}