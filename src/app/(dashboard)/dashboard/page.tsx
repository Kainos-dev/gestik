// src/app/(dashboard)/dashboard/page.tsx
import { getKpis, getProximosVencimientos, getUltimosMovimientos } from '@/features/dashboard/queries';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { VencimientosList } from '@/features/dashboard/components/vencimientos-list';
import { UltimosMovimientos } from '@/features/dashboard/components/ultimos-movimientos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/moneda';

export default async function DashboardPage() {
    const [kpis, vencimientos, movimientos] = await Promise.all([
        getKpis(),
        getProximosVencimientos(),
        getUltimosMovimientos(),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>

            {kpis.porMoneda.map((k) => (
                <div key={k.moneda} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                        label={`Dinero que debería entrar este mes (${k.moneda})`}
                        value={formatCurrency(k.totalFacturadoMes, k.moneda)}
                    />
                    <KpiCard
                        label={`Cobrado del mes (${k.moneda})`}
                        value={formatCurrency(k.totalCobradoMes, k.moneda)}
                    />
                    <KpiCard
                        label={`Pendiente (${k.moneda})`}
                        value={formatCurrency(k.totalPendiente, k.moneda)}
                    />
                </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <KpiCard label="Clientes activos" value={String(kpis.clientesActivos)} />
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