// src/app/(dashboard)/pagos/page.tsx
// La ruta sigue siendo /pagos, pero en la app la sección se llama "Cobros"
// (dinero recibido de clientes), igual que en el menú lateral.
import { getPagos, getPagosAnulados } from '@/features/pagos/queries';
import { getClientes } from '@/features/clients/queries';
import { getCargos } from '@/features/cargos/queries';
import { PagosRecibidosPanel } from '@/features/pagos/components/pagos-recibidos-panel';
import { CargosTable } from '@/features/cargos/components/cargos-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default async function PagosPage() {
    const [pagos, anulados, clientes, cargos] = await Promise.all([
        getPagos(),
        getPagosAnulados(),
        getClientes(),
        getCargos(),
    ]);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Cobros</h1>

            <Tabs defaultValue="cargos">
                <TabsList>
                    <TabsTrigger value="cargos">Cargos</TabsTrigger>
                    <TabsTrigger value="recibidos">Cobros recibidos</TabsTrigger>
                </TabsList>

                <TabsContent value="cargos" className="space-y-4 pt-4">
                    <CargosTable cargos={cargos} clientes={clientes} />
                </TabsContent>

                <TabsContent value="recibidos" className="space-y-4 pt-4">
                    <PagosRecibidosPanel pagos={pagos} anulados={anulados} clientes={clientes} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
