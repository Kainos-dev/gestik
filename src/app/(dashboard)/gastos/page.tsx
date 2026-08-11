// src/app/(dashboard)/gastos/page.tsx
import { getGastosFijos, getGastos } from '@/features/gastos/queries';
import { GastosFijosTable } from '@/features/gastos/components/gastos-fijos-table';
import { GastosTable } from '@/features/gastos/components/gastos-table';
import { NuevoGastoFijoDialog } from '@/features/gastos/components/new-gasto-fijo-dialog';
import { NuevoGastoDialog } from '@/features/gastos/components/new-gasto-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default async function GastosPage() {
    const [gastosFijos, gastos] = await Promise.all([getGastosFijos(), getGastos()]);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Gastos</h1>

            <Tabs defaultValue="registro">
                <TabsList>
                    <TabsTrigger value="registro">Registro de gastos</TabsTrigger>
                    <TabsTrigger value="fijos">Gastos fijos</TabsTrigger>
                </TabsList>

                <TabsContent value="registro" className="space-y-4 pt-4">
                    <div className="flex justify-end">
                        <NuevoGastoDialog />
                    </div>
                    <GastosTable gastos={gastos} />
                </TabsContent>

                <TabsContent value="fijos" className="space-y-4 pt-4">
                    <div className="flex justify-end">
                        <NuevoGastoFijoDialog />
                    </div>
                    <GastosFijosTable gastosFijos={gastosFijos} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
