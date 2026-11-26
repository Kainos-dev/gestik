// src/features/deudas/components/deudas-panel.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Deuda, Integrante, ReposicionDeuda } from '../types';
import { calcularEstadoDeuda, calcularPendientePorMoneda } from '../services';
import { MONEDAS, formatCurrency } from '@/lib/moneda';
import { DeudasTable } from './deudas-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Vista = 'ACTIVAS' | 'TODAS' | 'ELIMINADAS';

const VISTAS: { value: Vista; label: string }[] = [
    { value: 'ACTIVAS', label: 'Activas' },
    { value: 'TODAS', label: 'Todas' },
    { value: 'ELIMINADAS', label: 'Eliminadas' },
];

const TODAS_LAS_PERSONAS = 'TODAS';

function perteneceAVista(deuda: Deuda, vista: Vista): boolean {
    if (vista === 'ELIMINADAS') return deuda.eliminadaAt !== null;
    if (deuda.eliminadaAt !== null) return false;
    // Activas = todo lo que falta saldar, incluidas las parcialmente repuestas.
    return vista === 'TODAS' || calcularEstadoDeuda(deuda.montoTotal, deuda.montoRepuesto) === 'ACTIVA';
}

// Filtra en el cliente (son pocas filas y ya vienen todas en una sola query):
// cambiar de vista o de persona es instantáneo, sin ida al servidor.
export function DeudasPanel({
    deudas,
    integrantes,
    integrantesActivos,
    reposicionesPorDeuda,
    acciones,
}: {
    acciones?: ReactNode; // "Gestionar Integrantes" y "Nueva deuda", a la derecha de las vistas
    deudas: Deuda[];
    integrantes: Integrante[]; // todas, para el filtro (incluidas las desactivadas)
    integrantesActivos: Integrante[]; // para el formulario de edición
    reposicionesPorDeuda: Record<string, ReposicionDeuda[]>;
}) {
    const [vista, setVista] = useState<Vista>('ACTIVAS');
    const [persona, setPersona] = useState<string>(TODAS_LAS_PERSONAS);
    const [busqueda, setBusqueda] = useState('');

    const porPersona = persona === TODAS_LAS_PERSONAS ? deudas : deudas.filter((d) => d.integranteId === persona);
    // Se recalcula con cada router.refresh() (ej. después de una reposición),
    // porque sale de las mismas deudas que llegan del servidor.
    const pendientePersona = calcularPendientePorMoneda(porPersona);
    const visibles = porPersona.filter((d) => perteneceAVista(d, vista));
    const cantidadPorVista = Object.fromEntries(
        VISTAS.map((v) => [v.value, porPersona.filter((d) => perteneceAVista(d, v.value)).length])
    ) as Record<Vista, number>;

    // Sólo personas que tienen alguna deuda: elegir una sin deudas no mostraría nada.
    const personasConDeudas = integrantes.filter((i) => deudas.some((d) => d.integranteId === i.id));
    const nombrePersona = (id: string | null) =>
        id === TODAS_LAS_PERSONAS || !id
            ? 'Todas las personas'
            : (integrantes.find((i) => i.id === id)?.nombre ?? 'Todas las personas');

    return (
        <div className="space-y-3">
            {/* Renglón 1: vistas a la izquierda, acciones a la derecha. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div role="group" aria-label="Vista de deudas" className="inline-flex w-full rounded-md border p-0.5 sm:w-auto">
                    {VISTAS.map((v) => (
                        <Button
                            key={v.value}
                            type="button"
                            size="sm"
                            variant={vista === v.value ? 'default' : 'ghost'}
                            aria-pressed={vista === v.value}
                            className={cn('flex-1 sm:flex-none', v.value === 'ELIMINADAS' && vista !== v.value && 'text-muted-foreground')}
                            onClick={() => setVista(v.value)}
                        >
                            {v.label}
                            <span className="text-xs opacity-70">{cantidadPorVista[v.value]}</span>
                        </Button>
                    ))}
                </div>
                {acciones && <div className="flex flex-wrap gap-2 sm:justify-end">{acciones}</div>}
            </div>

            {/* Renglón 2: buscador y filtro por persona. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                    placeholder="Buscar deuda..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    aria-label="Buscar deuda"
                    className="sm:flex-1"
                />
                <div className="flex items-center gap-2 sm:flex-1">
                    <Select value={persona} onValueChange={(value) => setPersona(value ?? TODAS_LAS_PERSONAS)}>
                        <SelectTrigger aria-label="Filtrar por persona" className="w-full">
                            <SelectValue>{(value: string | null) => nombrePersona(value)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODAS_LAS_PERSONAS}>Todas las personas</SelectItem>
                            {personasConDeudas.map((integrante) => (
                                <SelectItem key={integrante.id} value={integrante.id}>
                                    {integrante.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {persona !== TODAS_LAS_PERSONAS && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Ver todas las personas"
                            onClick={() => setPersona(TODAS_LAS_PERSONAS)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Con "Todas las personas" ya están los totales generales arriba
                (DeudasTotales); con una persona elegida, lo que le debemos hoy. */}
            {persona !== TODAS_LAS_PERSONAS && (
                <div className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-sm text-muted-foreground">Le debemos a {nombrePersona(persona)}:</span>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        {MONEDAS.map((moneda) => (
                            <span key={moneda} className="text-lg font-semibold">
                                {formatCurrency(pendientePersona[moneda], moneda)}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">en {moneda}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {vista === 'ELIMINADAS' && (
                <p className="text-sm text-muted-foreground">
                    Deudas eliminadas: no cuentan en los totales, pero conservan su historial y se pueden restaurar.
                </p>
            )}

            <DeudasTable
                deudas={visibles}
                integrantes={integrantesActivos}
                reposicionesPorDeuda={reposicionesPorDeuda}
                busqueda={busqueda}
            />
        </div>
    );
}
