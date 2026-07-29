// src/app/(dashboard)/servicios/page.tsx
import { getServicios } from "@/features/services/queries";
import { getClientes } from "@/features/clients/queries";
import { ServiciosTable } from "@/features/services/components/services-table";
import { NuevoServicioDialog } from "@/features/services/components/new-service-dialog";

export default async function ServiciosPage() {
  const [servicios, clientes] = await Promise.all([
    getServicios(),
    getClientes(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Servicios</h1>
        <NuevoServicioDialog clientes={clientes} />
      </div>
      <ServiciosTable servicios={servicios} />
    </div>
  );
}
