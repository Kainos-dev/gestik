// src/features/pagos/components/pagos-recibidos-panel.tsx
'use client';

import { useState } from 'react';
import { Pago, PagoAnulado } from '../types';
import { PagosTable, PagosAnuladosTable } from './pagos-table';
import { NuevoPagoDialog } from './nuevo-pago-dialog';
import { Cliente } from '@/features/clients/types';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Vista = 'VIGENTES' | 'ANULADOS';
const TODOS_LOS_CLIENTES = 'TODOS';

// Filtra en el cliente (son pocas filas y ya vienen todas en una sola
// query): cambiar de cliente o de vista es instantáneo. El filtro vive en el
// estado del panel, así que se mantiene al editar, anular o restaurar
// (router.refresh() trae los datos nuevos sin desmontar el panel).
export function PagosRecibidosPanel({
    pagos,
    anulados,
    clientes,
}: {
    pagos: Pago[];
    anulados: PagoAnulado[];
    clientes: Cliente[];
}) {
    const [vista, setVista] = useState<Vista>('VIGENTES');
    const [cliente, setCliente] = useState<string>(TODOS_LOS_CLIENTES);

    const deCliente = <T,>(lista: T[], clienteId: (x: T) => string) =>
        cliente === TODOS_LOS_CLIENTES ? lista : lista.filter((x) => clienteId(x) === cliente);
    const pagosVisibles = deCliente(pagos, (p) => p.clienteId);
    const anuladosVisibles = deCliente(anulados, (a) => a.pago.clienteId);

    // Sólo clientes con algún cobro (vigente o anulado): elegir uno sin cobros no mostraría nada.
    const clientesConCobros = clientes.filter(
        (c) => pagos.some((p) => p.clienteId === c.id) || anulados.some((a) => a.pago.clienteId === c.id)
    );
    const etiquetaCliente = (id: string | null) => {
        const c = id && id !== TODOS_LOS_CLIENTES ? clientes.find((x) => x.id === id) : undefined;
        return c ? (
            <span className="flex items-center gap-2">
                <ClienteColorDot color={c.color} nombre={c.nombre} />
                {c.nombre}
            </span>
        ) : (
            'Todos los clientes'
        );
    };

    const VISTAS: { value: Vista; label: string; cantidad: number }[] = [
        { value: 'VIGENTES', label: 'Vigentes', cantidad: pagosVisibles.length },
        { value: 'ANULADOS', label: 'Anulados', cantidad: anuladosVisibles.length },
    ];

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div role="group" aria-label="Vista de cobros" className="inline-flex w-full rounded-md border p-0.5 sm:w-auto">
                    {VISTAS.map((v) => (
                        <Button
                            key={v.value}
                            type="button"
                            size="sm"
                            variant={vista === v.value ? 'default' : 'ghost'}
                            aria-pressed={vista === v.value}
                            className="flex-1 sm:flex-none"
                            onClick={() => setVista(v.value)}
                        >
                            {v.label}
                            <span className="text-xs opacity-70">{v.cantidad}</span>
                        </Button>
                    ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={cliente} onValueChange={(value) => setCliente(value ?? TODOS_LOS_CLIENTES)}>
                        <SelectTrigger aria-label="Filtrar por cliente" className="w-full sm:w-56">
                            <SelectValue>{(value: string | null) => etiquetaCliente(value)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS_LOS_CLIENTES}>Todos los clientes</SelectItem>
                            {clientesConCobros.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    <span className="flex items-center gap-2">
                                        <ClienteColorDot color={c.color} nombre={c.nombre} />
                                        {c.nombre}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <NuevoPagoDialog
                        clientes={clientes}
                        // Con un cliente elegido, el cobro nuevo arranca con ese cliente (se puede cambiar).
                        clienteIdInicial={cliente === TODOS_LOS_CLIENTES ? undefined : cliente}
                    />
                </div>
            </div>

            {vista === 'VIGENTES' ? (
                <PagosTable pagos={pagosVisibles} clientes={clientes} />
            ) : (
                <>
                    <p className="text-sm text-muted-foreground">
                        Cobros anulados: no cuentan en saldos, cuenta ni balances, pero conservan sus datos y su cotización
                        original y se pueden restaurar.
                    </p>
                    <PagosAnuladosTable anulados={anuladosVisibles} />
                </>
            )}
        </div>
    );
}
