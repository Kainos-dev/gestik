// src/app/(dashboard)/pagos/page.tsx
import { getPagos } from '@/features/pagos/queries';
import { getClientes } from '@/features/clients/queries';
import { getCargos } from '@/features/cargos/queries';
import { PagosTable } from '@/features/pagos/components/pagos-table';
import { NuevoPagoDialog } from '@/features/pagos/components/nuevo-pago-dialog';
import { CargosTable } from '@/features/cargos/components/cargos-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default async function PagosPage() {
    const [pagos, clientes, cargos] = await Promise.all([getPagos(), getClientes(), getCargos()]);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Pagos</h1>

            <Tabs defaultValue="cargos">
                <TabsList>
                    <TabsTrigger value="cargos">Cargos</TabsTrigger>
                    <TabsTrigger value="recibidos">Pagos recibidos</TabsTrigger>
                </TabsList>

                <TabsContent value="cargos" className="space-y-4 pt-4">
                    <CargosTable cargos={cargos} clientes={clientes} />
                </TabsContent>

                <TabsContent value="recibidos" className="space-y-4 pt-4">
                    <div className="flex justify-end">
                        <NuevoPagoDialog clientes={clientes} />
                    </div>
                    <PagosTable pagos={pagos} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
