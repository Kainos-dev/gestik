// src/app/(dashboard)/clients/page.tsx
import { getClientes } from "@/features/clients/queries";
import { ClientesTable } from "@/features/clients/components/clientes-table";
import { NuevoClienteDialog } from "@/features/clients/components/new-client-dialog.tsx";

export default async function ClientesPage() {
  const clientes = await getClientes(); // Server Component: pega directo a pg, sin Query
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold mb-4">Clientes</h1>
        <NuevoClienteDialog />
      </div>
      <ClientesTable clientes={clientes} />
    </div>
  );
}
