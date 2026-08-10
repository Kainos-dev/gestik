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
import { MONEDAS, formatCurrency } from '@/lib/moneda';

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

    // Balance por moneda: no tiene sentido restar gastos en USD de ingresos en ARS.
    const balancePorMoneda = MONEDAS.map((moneda) => {
        const ingresos = totalIngresosMes.find((i) => i.moneda === moneda)?.total ?? 0;
        const gastos = totalGastosMes.find((g) => g.moneda === moneda)?.total ?? 0;
        return { moneda, ingresos, gastos, balance: ingresos - gastos };
    });

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Gestión</h1>

            {balancePorMoneda.map((b) => (
                <div key={b.moneda} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard label={`Ingresos del mes (${b.moneda})`} value={formatCurrency(b.ingresos, b.moneda)} />
                    <KpiCard label={`Gastos del mes (${b.moneda})`} value={formatCurrency(b.gastos, b.moneda)} />
                    <KpiCard label={`Balance del mes (${b.moneda})`} value={formatCurrency(b.balance, b.moneda)} />
                </div>
            ))}

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
