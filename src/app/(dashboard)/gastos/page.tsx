// src/app/(dashboard)/gastos/page.tsx
import { getGastosFijos, getGastos } from '@/features/gastos/queries';
import {
    getDeudas,
    getIntegrantes,
    getIntegrantesActivos,
    getReposicionesAgrupadas,
    getTotalesDeudas,
} from '@/features/deudas/queries';
import { GastosFijosTable } from '@/features/gastos/components/gastos-fijos-table';
import { GastosFijosTotal } from '@/features/gastos/components/gastos-fijos-total';
import { calcularGastosFijosDelMes } from '@/features/gastos/services';
import { obtenerCotizacionCripto } from '@/lib/cotizacion-cripto';
import { GastosTable } from '@/features/gastos/components/gastos-table';
import { DeudasPanel } from '@/features/deudas/components/deudas-panel';
import { DeudasTotales } from '@/features/deudas/components/deudas-totales';
import { NuevoGastoFijoDialog } from '@/features/gastos/components/new-gasto-fijo-dialog';
import { NuevoGastoDialog } from '@/features/gastos/components/new-gasto-dialog';
import { NuevaDeudaDialog } from '@/features/deudas/components/new-deuda-dialog';
import { IntegrantesManagerDialog } from '@/features/deudas/components/integrantes-manager-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default async function GastosPage() {
    const [gastosFijos, gastos, deudas, integrantes, integrantesActivos, reposicionesPorDeuda, totalesDeudas, cotizacion] =
        await Promise.all([
            getGastosFijos(),
            getGastos(),
            getDeudas(),
            getIntegrantes(),
            getIntegrantesActivos(),
            getReposicionesAgrupadas(),
            getTotalesDeudas(),
            obtenerCotizacionCripto(), // estimación del costo de ARQ para los gastos fijos en USD
        ]);
    // Mismo cálculo que la tarjeta "Gastos Fijos" de Balance Mensual.
    const gastosFijosDelMes = calcularGastosFijosDelMes(gastosFijos, new Date(), cotizacion?.venta ?? null);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Gastos</h1>

            {/* Orden fijo: Gastos Fijos (abre por defecto) | Deudas | Historial de Gastos. */}
            <Tabs defaultValue="fijos">
                <TabsList>
                    <TabsTrigger value="fijos">Gastos Fijos</TabsTrigger>
                    <TabsTrigger value="deudas">Deudas</TabsTrigger>
                    <TabsTrigger value="registro">Historial de Gastos</TabsTrigger>
                </TabsList>

                <TabsContent value="fijos" className="space-y-4 pt-4">
                    <GastosFijosTotal delMes={gastosFijosDelMes} cotizacion={cotizacion} />
                    <GastosFijosTable
                        gastosFijos={gastosFijos}
                        cotizacion={cotizacion}
                        acciones={<NuevoGastoFijoDialog />}
                    />
                </TabsContent>

                <TabsContent value="deudas" className="space-y-4 pt-4">
                    <DeudasTotales totales={totalesDeudas} />
                    <DeudasPanel
                        acciones={
                            <>
                                <IntegrantesManagerDialog integrantes={integrantes} />
                                <NuevaDeudaDialog integrantes={integrantesActivos} />
                            </>
                        }
                        deudas={deudas}
                        integrantes={integrantes}
                        integrantesActivos={integrantesActivos}
                        reposicionesPorDeuda={reposicionesPorDeuda}
                    />
                </TabsContent>

                <TabsContent value="registro" className="space-y-4 pt-4">
                    <GastosTable gastos={gastos} acciones={<NuevoGastoDialog />} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
