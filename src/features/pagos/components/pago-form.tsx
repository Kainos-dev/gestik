// src/features/pagos/components/pago-form.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { PagoSchema, PagoInput, METODOS_PAGO } from '../schema';
import { crearPago, editarPago } from '../actions';
import { calcularEquivalenteUsd, calcularMontoAcreditado, calcularSaldoRestante, usaCotizacionAutomatica } from '../services';
import { obtenerCotizacionBlue } from '@/lib/cotizacion-dolar-actions';
import { Pago } from '../types';
import { Cliente } from '@/features/clients/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { METODO_PAGO_LABELS, TIPO_SERVICIO_LABELS } from '@/lib/constants';
import { MONEDAS, Moneda, formatCurrency } from '@/lib/moneda';
import { ClienteColorDot } from '@/components/shared/cliente-color-dot';
import { DatePicker } from '@/components/shared/date-picker';
import { ImporteInterpretado } from '@/components/shared/importe-interpretado';
import { importeOnull } from '@/lib/importe';
import { dateToSqlDateString, formatDate } from '@/lib/utils';

interface ServicioOption {
    id: string;
    tipo: string;
    nombre_personalizado: string | null;
    moneda: Moneda;
    saldo_pendiente: number; // en la moneda del servicio, sin contar el pago que se edita
}

function nombreServicioOption(s: ServicioOption) {
    return s.tipo === 'OTRO' ? s.nombre_personalizado : TIPO_SERVICIO_LABELS[s.tipo];
}

interface PagoFormProps {
    clientes: Cliente[];
    pago?: Pago;
    clienteIdFijo?: string; // cuando se registra desde el detalle de un cliente
    clienteIdInicial?: string; // precargado pero editable (el cliente filtrado en Cobros)
    servicioIdFijo?: string; // cuando se registra desde un cargo puntual
    montoSugerido?: number; // precarga el monto (ej. el saldo pendiente del cargo)
    onSuccess?: () => void;
}

export function PagoForm({
    clientes,
    pago,
    clienteIdFijo,
    clienteIdInicial,
    servicioIdFijo,
    montoSugerido,
    onSuccess,
}: PagoFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const esEdicion = Boolean(pago);
    const [servicios, setServicios] = useState<ServicioOption[]>([]);

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm<PagoInput>({
        resolver: zodResolver(PagoSchema),
        defaultValues: {
            clienteId: pago?.clienteId ?? clienteIdFijo ?? clienteIdInicial ?? '',
            servicioId: pago?.servicioId ?? servicioIdFijo ?? '',
            fecha: pago?.fecha ?? new Date(),
            montoPagado: pago?.montoPagado ?? montoSugerido ?? 0,
            monedaPago: pago?.monedaPago ?? 'ARS',
            tipoCambio: pago?.tipoCambio ?? undefined,
            metodoPago: pago?.metodoPago ?? 'TRANSFERENCIA',
            comprobanteUrl: pago?.comprobanteUrl ?? '',
            notas: pago?.notas ?? '',
        },
    });

    const clienteSeleccionado = watch('clienteId');
    const servicioSeleccionado = watch('servicioId');
    const monedaPago = watch('monedaPago');
    const montoPagado = watch('montoPagado');
    const tipoCambio = watch('tipoCambio');
    const fecha = watch('fecha');

    // Cuando cambia el cliente, recarga la lista de servicios disponibles para asociar
    useEffect(() => {
        if (!clienteSeleccionado) {
            setServicios([]);
            return;
        }
        const params = new URLSearchParams({ clienteId: clienteSeleccionado });
        if (pago) params.set('excluirPagoId', pago.id);
        fetch(`/api/servicios/por-cliente?${params}`)
            .then((res) => res.json())
            .then(setServicios)
            .catch(() => setServicios([]));
    }, [clienteSeleccionado, pago]);

    // Al elegir un servicio, la moneda en la que pagó arranca igual a la del
    // servicio como valor por defecto (el caso más común), pero queda
    // editable: si el cliente pagó en otra moneda, más abajo aparece el
    // campo de tipo de cambio para convertir — ver requiereConversion. Sólo
    // se aplica al crear: en edición NO hay que pisar la monedaPago que ya
    // traía el pago (podría ser justamente uno pagado en otra moneda) apenas
    // se resuelve la lista de servicios y matchea el servicio actual.
    const servicioElegido = servicios.find((s) => s.id === servicioSeleccionado);
    useEffect(() => {
        if (!esEdicion && servicioElegido) setValue('monedaPago', servicioElegido.moneda);
    }, [esEdicion, servicioElegido, setValue]);

    const requiereConversion = Boolean(servicioElegido) && monedaPago !== servicioElegido?.moneda;
    // Servicio en USD cobrado en pesos: la cotización sale sola (blue venta
    // del día del cobro) y el servidor la vuelve a resolver al guardar — ver
    // resolverConversion en pagos/actions.ts. El caso inverso (servicio en
    // ARS cobrado en USD) sigue pidiendo el tipo de cambio a mano.
    const cotizacionAutomatica = servicioElegido ? usaCotizacionAutomatica(servicioElegido.moneda, monedaPago) : false;
    const tipoCambioManual = requiereConversion && !cotizacionAutomatica;
    const fechaSql = fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? dateToSqlDateString(fecha) : null;

    // Al editar un cobro ya convertido, si no cambia la fecha, el servicio ni
    // la moneda, se conserva la cotización con la que se registró (el
    // servidor hace el mismo chequeo): nunca se recalcula un pago histórico.
    const cotizacionHistorica =
        pago &&
        pago.tipoCambio &&
        pago.servicioId === servicioSeleccionado &&
        pago.monedaPago === monedaPago &&
        pago.moneda === servicioElegido?.moneda &&
        fechaSql === dateToSqlDateString(new Date(pago.fecha))
            ? pago.tipoCambio
            : null;

    const cotizacion = useQuery({
        queryKey: ['cotizacion-blue-venta', fechaSql],
        queryFn: () => obtenerCotizacionBlue(fechaSql!),
        enabled: cotizacionAutomatica && cotizacionHistorica === null && fechaSql !== null,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
    const cotizacionOk = cotizacion.data?.ok ? cotizacion.data : null;
    const errorCotizacion = cotizacion.isError
        ? 'No se pudo obtener la cotización del dólar blue. Probá de nuevo.'
        : cotizacion.data && !cotizacion.data.ok
          ? cotizacion.data.error
          : null;
    const cotizacionAplicada = cotizacionHistorica ?? cotizacionOk?.venta ?? null;
    const equivalenteUsd =
        cotizacionAutomatica && cotizacionAplicada !== null
            ? calcularEquivalenteUsd(importeOnull(montoPagado) ?? 0, cotizacionAplicada)
            : null;
    const sinCotizacion = cotizacionAutomatica && cotizacionAplicada === null;

    let montoAcreditadoPreview: number | null = null;
    const tipoCambioInterpretado = importeOnull(tipoCambio, { decimales: 4 });
    if (tipoCambioManual && servicioElegido && tipoCambioInterpretado) {
        try {
            montoAcreditadoPreview = calcularMontoAcreditado(
                importeOnull(montoPagado) ?? 0,
                monedaPago,
                servicioElegido.moneda,
                tipoCambioInterpretado
            );
        } catch {
            montoAcreditadoPreview = null;
        }
    }

    function onSubmit(data: PagoInput) {
        if (tipoCambioManual && !data.tipoCambio) {
            toast.error('Ingresá el tipo de cambio para convertir el pago');
            return;
        }
        // Con cotización automática no se manda ningún tipo de cambio: lo decide el servidor.
        const datos: PagoInput = { ...data, tipoCambio: tipoCambioManual ? data.tipoCambio : undefined };

        startTransition(async () => {
            try {
                const resultado = esEdicion && pago ? await editarPago(pago.id, datos) : await crearPago(datos);
                if (!resultado.ok) {
                    toast.error(resultado.error);
                    // Si falló por la cotización, refrescar la que se muestra.
                    if (cotizacionAutomatica && cotizacionHistorica === null) cotizacion.refetch();
                    return;
                }
                const accion = esEdicion ? 'Cobro actualizado' : 'Cobro registrado';
                toast.success(
                    cotizacionAutomatica && resultado.tipoCambio
                        ? `${accion}: se acreditaron ${formatCurrency(resultado.montoAcreditado, resultado.moneda)} (blue venta ${formatCurrency(resultado.tipoCambio, 'ARS')})`
                        : accion
                );
                router.refresh();
                onSuccess?.();
            } catch (error) {
                toast.error('Ocurrió un error al guardar el cobro');
                console.error(error);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!clienteIdFijo && (
                <div className="space-y-1.5">
                    <Label htmlFor="clienteId">Cliente *</Label>
                    <Controller
                        name="clienteId"
                        control={control}
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={(value) => {
                                    // El servicio elegido era del cliente anterior: hay que volver a elegirlo.
                                    if (value !== field.value) setValue('servicioId', '');
                                    field.onChange(value);
                                }}
                            >
                                <SelectTrigger id="clienteId">
                                    <SelectValue placeholder="Seleccionar cliente">
                                        {(value: string) => {
                                            const c = clientes.find((c) => c.id === value);
                                            return c ? (
                                                <span className="flex items-center gap-2">
                                                    <ClienteColorDot color={c.color} nombre={c.nombre} />
                                                    {c.nombre}
                                                </span>
                                            ) : (
                                                'Seleccionar cliente'
                                            );
                                        }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {clientes.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            <span className="flex items-center gap-2">
                                                <ClienteColorDot color={c.color} nombre={c.nombre} />
                                                {c.nombre}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.clienteId && <p className="text-sm text-red-600">{errors.clienteId.message}</p>}
                </div>
            )}

            {!servicioIdFijo && (
                <div className="space-y-1.5">
                    <Label htmlFor="servicioId">Servicio (opcional)</Label>
                    <Controller
                        name="servicioId"
                        control={control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} disabled={!clienteSeleccionado}>
                                <SelectTrigger id="servicioId">
                                    <SelectValue placeholder="Sin asociar a un servicio puntual">
                                        {(value: string) => {
                                            const servicio = servicios.find((s) => s.id === value);
                                            return servicio ? nombreServicioOption(servicio) : 'Sin asociar a un servicio puntual';
                                        }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {servicios.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {nombreServicioOption(s)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="montoPagado">Monto recibido *</Label>
                    <div className="flex gap-2">
                        <Input
                            id="montoPagado"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="flex-1"
                            {...register('montoPagado')}
                        />
                        <Controller
                            name="monedaPago"
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="monedaPago" className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONEDAS.map((moneda) => (
                                            <SelectItem key={moneda} value={moneda}>
                                                {moneda}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    {servicioElegido && !requiereConversion && (
                        <p className="text-xs text-muted-foreground">
                            Misma moneda que el servicio asociado ({servicioElegido.moneda}).
                        </p>
                    )}
                    <ImporteInterpretado valor={montoPagado} moneda={monedaPago} />
                    {errors.montoPagado && <p className="text-sm text-red-600">{errors.montoPagado.message}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <Controller
                        name="fecha"
                        control={control}
                        render={({ field }) => <DatePicker id="fecha" value={field.value as Date | undefined} onChange={field.onChange} />}
                    />
                    {errors.fecha && <p className="text-sm text-red-600">{errors.fecha.message}</p>}
                </div>
            </div>

            {cotizacionAutomatica && servicioElegido && (
                <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {cotizacionAplicada !== null ? (
                        <>
                            <p>
                                Cotización aplicada:{' '}
                                <span className="font-medium">{formatCurrency(cotizacionAplicada, 'ARS')}</span>{' '}
                                <span className="text-muted-foreground">
                                    {cotizacionHistorica !== null || !cotizacionOk
                                        ? '(la registrada con este pago)'
                                        : `(dólar blue venta del ${formatDate(cotizacionOk.fecha)})`}
                                </span>
                            </p>
                            <p className="text-muted-foreground">
                                Equivalente abonado:{' '}
                                <span className="font-medium text-foreground">
                                    {formatCurrency(equivalenteUsd ?? 0, servicioElegido.moneda)}
                                </span>
                            </p>
                            <p className="text-muted-foreground">
                                Saldo pendiente del servicio:{' '}
                                {formatCurrency(
                                    calcularSaldoRestante(servicioElegido.saldo_pendiente, equivalenteUsd ?? 0),
                                    servicioElegido.moneda
                                )}{' '}
                                (de {formatCurrency(servicioElegido.saldo_pendiente, servicioElegido.moneda)})
                            </p>
                        </>
                    ) : cotizacion.isFetching ? (
                        <p className="text-muted-foreground">Buscando la cotización del dólar blue…</p>
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-red-600">{errorCotizacion ?? 'Falta la cotización del dólar blue.'}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => cotizacion.refetch()}>
                                <RefreshCw className="h-4 w-4" />
                                Reintentar
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {tipoCambioManual && servicioElegido && (
                <div className="space-y-1.5">
                    <Label htmlFor="tipoCambio">Tipo de cambio (ARS por USD) *</Label>
                    <Input
                        id="tipoCambio"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Ej: 1.500"
                        {...register('tipoCambio')}
                    />
                    <ImporteInterpretado valor={tipoCambio} moneda="ARS" decimales={4} etiqueta="Se aplica" />
                    <p className="text-sm text-muted-foreground">
                        {montoAcreditadoPreview !== null
                            ? `Se acreditan ${formatCurrency(montoAcreditadoPreview, servicioElegido.moneda)} al servicio (en ${servicioElegido.moneda}).`
                            : 'Ingresá el tipo de cambio para ver cuánto se acredita al servicio.'}
                    </p>
                </div>
            )}

            <div className="space-y-1.5">
                <Label htmlFor="metodoPago">Método de pago *</Label>
                <Controller
                    name="metodoPago"
                    control={control}
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="metodoPago">
                                <SelectValue>{(value: string) => METODO_PAGO_LABELS[value] ?? value}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {METODOS_PAGO.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {METODO_PAGO_LABELS[m]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="comprobanteUrl">Comprobante (URL)</Label>
                <Input id="comprobanteUrl" placeholder="https://..." {...register('comprobanteUrl')} />
                {errors.comprobanteUrl && <p className="text-sm text-red-600">{errors.comprobanteUrl.message}</p>}
                <p className="text-xs text-muted-foreground">
                    Por ahora pegá el link manualmente. La subida de archivos se conecta cuando armemos el storage.
                </p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" rows={3} {...register('notas')} />
            </div>

            <Button type="submit" disabled={isPending || sinCotizacion} className="w-full">
                {isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar cobro'}
            </Button>
        </form>
    );
}