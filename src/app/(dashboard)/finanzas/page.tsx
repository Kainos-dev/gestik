// src/app/(dashboard)/finanzas/page.tsx
import { getIngresosPorMes, getIngresosPorCliente, getClientesConDeuda } from '@/features/finanzas/queries';
import { getPagos } from '@/features/pagos/queries';
import { IngresosChart } from '@/features/finanzas/components/ingresos-chart';
import { RankingClientes } from '@/features/finanzas/components/ranking-clientes';
import { ClientesDeuda } from '@/features/finanzas/components/clientes-deuda';
import { HistorialTable } from '@/features/finanzas/components/historial-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function FinanzasPage() {
    const [ingresosPorMes, ingresosPorCliente, clientesConDeuda, historial] = await Promise.all([
        getIngresosPorMes(),
        getIngresosPorCliente(),
        getClientesConDeuda(),
        getPagos(),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Finanzas</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ingresos últimos 6 meses</CardTitle>
                </CardHeader>
                <CardContent>
                    <IngresosChart data={ingresosPorMes} />
                </CardContent>
            </Card>

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