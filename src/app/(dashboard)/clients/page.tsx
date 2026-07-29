// src/app/(dashboard)/clients/page.tsx
import { getClientes } from '@/features/clients/queries';
import { ClientesTable } from '@/features/clients/components/clientes-table';

export default async function ClientesPage() {
    const clientes = await getClientes(); // Server Component: pega directo a pg, sin Query
    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Clientes</h1>
            <ClientesTable clientes={clientes} />
        </div>
    );
}