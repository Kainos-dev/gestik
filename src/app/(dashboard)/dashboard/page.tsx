// src/app/(dashboard)/dashboard/page.tsx
import { getKpis, getProximosVencimientos, getUltimosMovimientos } from '@/features/dashboard/queries';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { VencimientosList } from '@/features/dashboard/components/vencimientos-list';
import { UltimosMovimientos } from '@/features/dashboard/components/ultimos-movimientos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export default async function DashboardPage() {
    const [kpis, vencimientos, movimientos] = await Promise.all([
        getKpis(),
        getProximosVencimientos(),
        getUltimosMovimientos(),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Facturado del mes" value={formatCurrency(kpis.totalFacturadoMes)} />
                <KpiCard label="Cobrado del mes" value={formatCurrency(kpis.totalCobradoMes)} />
                <KpiCard label="Total pendiente" value={formatCurrency(kpis.totalPendiente)} />
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