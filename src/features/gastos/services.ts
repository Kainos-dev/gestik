// src/features/gastos/services.ts
import { EstadoGastoFijo, EstadoPagoGastoFijo, FrecuenciaGasto, GastoFijo } from './types';
import { MONEDAS, Moneda } from '@/lib/moneda';

/**
 * Calcula el próximo vencimiento de un gasto fijo a partir de una fecha base
 * y su frecuencia. A diferencia de los servicios, un gasto fijo siempre es
 * recurrente (no existe la frecuencia "único"), así que siempre devuelve fecha.
 *
 * MENSUAL: mismo día del mes siguiente (ej. vence el 5, próximo el 5 del mes
 * que viene). MENSUAL_30_DIAS: 30 días exactos desde la fecha base, para
 * planes que facturan por ciclo fijo en vez de por calendario (ej. Adobe) —
 * con MENSUAL ese tipo de plan puede desalinearse un par de días por mes.
 */
export function calcularProximoVencimiento(fechaBase: Date, frecuencia: FrecuenciaGasto): Date {
    const proximo = new Date(fechaBase);
    if (frecuencia === 'MENSUAL') proximo.setMonth(proximo.getMonth() + 1);
    if (frecuencia === 'MENSUAL_30_DIAS') proximo.setDate(proximo.getDate() + 30);
    if (frecuencia === 'ANUAL') proximo.setFullYear(proximo.getFullYear() + 1);
    return proximo;
}

/**
 * Estado de pago calculado (no persistido) a partir de "proximoVencimiento":
 * mismo criterio que calcularEstadoCargo en cargos/services.ts — VENCIDO
 * cuando ya pasó la fecha. Devuelve null si el gasto fijo no está ACTIVO
 * (uno pausado o finalizado no tiene sentido marcarlo como atrasado).
 */
export function calcularEstadoPagoGastoFijo(
    estado: EstadoGastoFijo,
    proximoVencimiento: Date | null,
): EstadoPagoGastoFijo | null {
    if (estado !== 'ACTIVO' || !proximoVencimiento) return null;

    // "proximoVencimiento" se guarda como medianoche UTC del día elegido
    // (igual criterio que formatDate usa para mostrarlo), así que hay que
    // leerlo con los getters UTC acá también — truncar con setHours() local
    // lo corre un día para atrás en timezones negativos (ej. Argentina).
    const fechaVencimiento = new Date(proximoVencimiento);
    const vencimientoUTC = Date.UTC(
        fechaVencimiento.getUTCFullYear(),
        fechaVencimiento.getUTCMonth(),
        fechaVencimiento.getUTCDate(),
    );

    const hoy = new Date();
    const hoyLocal = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    return vencimientoUTC < hoyLocal ? 'VENCIDO' : 'AL_DIA';
}

/**
 * Gastos fijos ACTIVOS que hay que pagar "a esta altura del mes": no sólo
 * los que vencen dentro del mes actual, sino también los atrasados de meses
 * anteriores — a diferencia de "servicios", acá no hay cron que adelante
 * proximoVencimiento solo, así que un gasto fijo no registrado a tiempo se
 * queda con la fecha vieja hasta que alguien lo registra manualmente. Mismo
 * criterio UTC que calcularEstadoPagoGastoFijo.
 */
export function filtrarGastosFijosDelMes(gastosFijos: GastoFijo[], hoy: Date = new Date()): GastoFijo[] {
    const inicioProximoMesUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth() + 1, 1);

    return gastosFijos.filter((gastoFijo) => {
        if (gastoFijo.estado !== 'ACTIVO' || !gastoFijo.proximoVencimiento) return false;

        const vencimiento = new Date(gastoFijo.proximoVencimiento);
        const vencimientoUTC = Date.UTC(
            vencimiento.getUTCFullYear(),
            vencimiento.getUTCMonth(),
            vencimiento.getUTCDate(),
        );

        return vencimientoUTC < inicioProximoMesUTC;
    });
}

export interface TotalPorMoneda {
    moneda: Moneda;
    total: number;
}

export function calcularTotalPorMoneda(gastosFijos: GastoFijo[]): TotalPorMoneda[] {
    const totales = new Map<Moneda, number>();
    for (const gastoFijo of gastosFijos) {
        totales.set(gastoFijo.moneda, (totales.get(gastoFijo.moneda) ?? 0) + gastoFijo.monto);
    }
    return MONEDAS.map((moneda) => ({ moneda, total: totales.get(moneda) ?? 0 }));
}
