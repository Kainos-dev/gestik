// src/app/(dashboard)/gestion/page.tsx
import {
    getIngresosPorMes,
    getIngresosPorCliente,
    getClientesConDeuda,
    getTotalIngresosMes,
} from '@/features/finanzas/queries';
import { getPagos } from '@/features/pagos/queries';
import { getGastosPorMes, getTotalGastosMes } from '@/features/gastos/queries';
import { IngresosChart } from '@/features/finanzas/components/ingresos-chart';
import { GastosChart } from '@/features/gastos/components/gastos-chart';
import { RankingClientes } from '@/features/finanzas/components/ranking-clientes';
import { ClientesDeuda } from '@/features/finanzas/components/clientes-deuda';
import { HistorialTable } from '@/features/finanzas/components/historial-table';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export default async function GestionPage() {
    const [
        ingresosPorMes,
        ingresosPorCliente,
        clientesConDeuda,
        historial,
        gastosPorMes,
        totalIngresosMes,
        totalGastosMes,
    ] = await Promise.all([
        getIngresosPorMes(),
        getIngresosPorCliente(),
        getClientesConDeuda(),
        getPagos(),
        getGastosPorMes(),
        getTotalIngresosMes(),
        getTotalGastosMes(),
    ]);

    const balanceMes = totalIngresosMes - totalGastosMes;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Gestión</h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="Ingresos del mes" value={formatCurrency(totalIngresosMes)} />
                <KpiCard label="Gastos del mes" value={formatCurrency(totalGastosMes)} />
                <KpiCard label="Balance del mes" value={formatCurrency(balanceMes)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ingresos últimos 6 meses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <IngresosChart data={ingresosPorMes} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Gastos últimos 6 meses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <GastosChart data={gastosPorMes} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        <ClientesDeuda clientes={clientesConDeuda} />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Historial completo</CardTitle>
                </CardHeader>
                <CardContent>
                    <HistorialTable pagos={historial} />
                </CardContent>
            </Card>
        </div>
    );
}
