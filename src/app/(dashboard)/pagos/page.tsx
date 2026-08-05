// src/app/(dashboard)/pagos/page.tsx
import { getPagos } from '@/features/pagos/queries';
import { getClientes } from '@/features/clients/queries';
import { PagosTable } from '@/features/pagos/components/pagos-table';
import { NuevoPagoDialog } from '@/features/pagos/components/nuevo-pago-dialog';

export default async function PagosPage() {
    const [pagos, clientes] = await Promise.all([getPagos(), getClientes()]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Pagos</h1>
                <NuevoPagoDialog clientes={clientes} />
            </div>
            <PagosTable pagos={pagos} />
        </div>
    );
}