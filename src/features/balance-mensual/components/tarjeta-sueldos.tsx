// src/features/balance-mensual/components/tarjeta-sueldos.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/shared/date-picker';
import { programarPorcentajeSueldos } from '../actions';
import { PorcentajeSueldo, PORCENTAJE_SUELDOS_MAXIMO, inicioDeMesUtc, porcentajeVigente } from '../services';
import { RepartoMensual } from '../types';
import { parsearImporte } from '@/lib/importe';
import { formatCurrency } from '@/lib/moneda';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreMes = (d: Date) => MESES[new Date(d).getUTCMonth()];
const mesAnio = (d: Date) => `${nombreMes(d)} ${new Date(d).getUTCFullYear()}`;
const pct = (p: number) => `${Number.isInteger(p) ? p : p.toLocaleString('es-AR')}%`;

// Tarjeta "Sueldos" del Balance Mensual: el sueldo del último reparto cerrado,
// con el porcentaje con que se calculó ESE mes (guardado en el reparto). Al
// tocarla se abre la configuración: historial de porcentajes y un cambio
// nuevo que rige desde el mes elegido, sin tocar meses ya cerrados.
export function TarjetaSueldos({
    reparto,
    porcentajes,
}: {
    reparto: RepartoMensual | null;
    porcentajes: PorcentajeSueldo[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [porcentaje, setPorcentaje] = useState('');
    const [desde, setDesde] = useState<Date | undefined>(undefined);

    const hoy = new Date();
    const vigenteHoy = porcentajeVigente(porcentajes, hoy);
    const inicioMesActual = inicioDeMesUtc(hoy).getTime();
    const proximoCambio = porcentajes.find((p) => inicioDeMesUtc(p.vigenteDesde).getTime() > inicioMesActual);
    const historial = [...porcentajes].sort((a, b) => new Date(b.vigenteDesde).getTime() - new Date(a.vigenteDesde).getTime());
    const vigenteHoyDesde = historial.find((p) => inicioDeMesUtc(p.vigenteDesde).getTime() <= inicioMesActual);

    const interpretado = porcentaje.trim() ? parsearImporte(porcentaje) : null;
    const porcentajeValido =
        interpretado?.ok && interpretado.valor > 0 && interpretado.valor <= PORCENTAJE_SUELDOS_MAXIMO ? interpretado.valor : null;

    function abrir(abierto: boolean) {
        if (abierto) {
            setPorcentaje('');
            setDesde(undefined);
        }
        setOpen(abierto);
    }

    function guardar() {
        if (porcentajeValido === null || !desde) return;
        startTransition(async () => {
            try {
                const r = await programarPorcentajeSueldos({ porcentaje: porcentajeValido, vigenteDesde: desde });
                if (!r.ok) {
                    toast.error(r.error);
                    return;
                }
                const [anio, mes] = r.vigenteDesde.split('-').map(Number);
                toast.success(`Sueldos en ${pct(porcentajeValido)} desde ${MESES[mes - 1]} ${anio}`);
                setPorcentaje('');
                setDesde(undefined);
                router.refresh();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el porcentaje');
                console.error(error);
            }
        });
    }

    return (
        <>
            <button type="button" onClick={() => abrir(true)} className="h-full text-left cursor-pointer">
                <Card size="sm" className="h-full gap-2 transition-colors hover:bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {reparto
                                ? `Sueldos (${pct(reparto.porcentajeSueldos)} de los ingresos de ${nombreMes(reparto.mes)})`
                                : `Sueldos (${pct(vigenteHoy)})`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-0.5">
                        <p className="text-2xl font-semibold">{reparto ? formatCurrency(reparto.sueldosArs, 'ARS') : '—'}</p>
                        <p className="text-xs text-muted-foreground">
                            {reparto
                                ? `Calculado sobre lo Facturado en ${mesAnio(reparto.mes)}.`
                                : 'Todavía no hay ningún reparto cerrado.'}{' '}
                            {proximoCambio
                                ? `Desde ${mesAnio(proximoCambio.vigenteDesde)}: ${pct(proximoCambio.porcentaje)}.`
                                : 'Tocá para configurar el porcentaje.'}
                        </p>
                    </CardContent>
                </Card>
            </button>

            <Dialog open={open} onOpenChange={abrir}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Porcentaje de sueldos</DialogTitle>
                        <DialogDescription>
                            Qué parte de lo Facturado de cada mes va a sueldos. Un cambio rige desde el mes que elijas y no
                            modifica los meses que ya tienen el reparto cerrado.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        Vigente este mes ({mesAnio(hoy)}): <span className="font-semibold">{pct(vigenteHoy)}</span>
                        {reparto && reparto.porcentajeSueldos !== vigenteHoy && (
                            <p className="text-xs text-muted-foreground">
                                El último reparto cerrado ({mesAnio(reparto.mes)}) se calculó con {pct(reparto.porcentajeSueldos)}.
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="porcentajeSueldos">Nuevo porcentaje *</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="porcentajeSueldos"
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder="Ej: 30"
                                        value={porcentaje}
                                        onChange={(e) => setPorcentaje(e.target.value)}
                                    />
                                    <span className="text-muted-foreground">%</span>
                                </div>
                                {interpretado && porcentajeValido === null && (
                                    <p className="text-xs text-red-600">
                                        {interpretado.ok
                                            ? `Tiene que ser mayor a 0 y como máximo ${PORCENTAJE_SUELDOS_MAXIMO}% (gastos fijos y deudas ya ocupan el 30%).`
                                            : interpretado.error}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="vigenteDesde">Se aplica desde *</Label>
                                <DatePicker id="vigenteDesde" value={desde} onChange={(d) => setDesde(d ?? undefined)} />
                                {desde && (
                                    <p className="text-xs text-muted-foreground">Desde el reparto de {mesAnio(inicioDeMesUtc(desde))}.</p>
                                )}
                            </div>
                        </div>
                        <Button className="w-full" onClick={guardar} disabled={isPending || porcentajeValido === null || !desde}>
                            {isPending ? 'Guardando...' : 'Guardar porcentaje'}
                        </Button>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-sm font-medium">Historial</p>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted-foreground border-b">
                                    <th className="pb-2 font-medium">Desde</th>
                                    <th className="pb-2 font-medium text-right">Porcentaje</th>
                                    <th className="pb-2 font-medium text-right" />
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map((p) => {
                                    const desdeMs = inicioDeMesUtc(p.vigenteDesde).getTime();
                                    const estado =
                                        desdeMs > inicioMesActual ? 'Programado' : p === vigenteHoyDesde ? 'Vigente' : null;
                                    return (
                                        <tr key={desdeMs} className="border-b last:border-0">
                                            <td className="py-2">{mesAnio(p.vigenteDesde)}</td>
                                            <td className="py-2 text-right font-medium">{pct(p.porcentaje)}</td>
                                            <td className="py-2 text-right">
                                                {estado && <Badge variant={estado === 'Vigente' ? 'default' : 'outline'}>{estado}</Badge>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
