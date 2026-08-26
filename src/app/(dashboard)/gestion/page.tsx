// src/app/(dashboard)/gestion/page.tsx
import {
    getIngresosPorMes,
    getIngresosPorCliente,
    getClientesConDeuda,
    getTotalIngresosMes,
} from '@/features/finanzas/queries';
import { getPagos } from '@/features/pagos/queries';
import { getGastosPorMes, getTotalGastosMes } from '@/features/gastos/queries';
import { getTotalReposicionesDeudaMes } from '@/features/deudas/queries';
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
        totalReposicionesDeudaMes,
    ] = await Promise.all([
        getIngresosPorMes(),
        getIngresosPorCliente(),
        getClientesConDeuda(),
        getPagos(),
        getGastosPorMes(),
        getTotalIngresosMes(),
        getTotalGastosMes(),
        getTotalReposicionesDeudaMes(),
    ]);

    // Balance por moneda: no tiene sentido restar gastos en USD de ingresos en ARS.
    // "gastos" acá son solo gastos fijos (ver getTotalGastosMes) — los gastos
    // sueltos (una cámara, una notebook) no se descuentan del balance. Las
    // reposiciones de deuda sí se descuentan (plata que efectivamente salió
    // este mes para devolverle a un integrante), agrupadas por la moneda en
    // la que se pagaron (no la moneda de la deuda) — ver getTotalReposicionesDeudaMes.
    const balancePorMoneda = MONEDAS.map((moneda) => {
        const ingresos = totalIngresosMes.find((i) => i.moneda === moneda)?.total ?? 0;
        const gastos = totalGastosMes.find((g) => g.moneda === moneda)?.total ?? 0;
        const reposicionesDeuda = totalReposicionesDeudaMes.find((r) => r.moneda === moneda)?.total ?? 0;
        return { moneda, ingresos, gastos, reposicionesDeuda, balance: ingresos - gastos - reposicionesDeuda };
    });

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Gestión</h1>

            {balancePorMoneda.map((b) => (
                <div key={b.moneda} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <KpiCard label={`Ingresos del mes (${b.moneda})`} value={formatCurrency(b.ingresos, b.moneda)} />
                    <KpiCard label={`Gastos fijos del mes (${b.moneda})`} value={formatCurrency(b.gastos, b.moneda)} />
                    <KpiCard
                        label={`Reposiciones de deuda del mes (${b.moneda})`}
                        value={formatCurrency(b.reposicionesDeuda, b.moneda)}
                    />
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
