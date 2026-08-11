// src/features/gastos/services.ts
import { EstadoGastoFijo, EstadoPagoGastoFijo, FrecuenciaGasto } from './types';

/**
 * Calcula el próximo vencimiento de un gasto fijo a partir de una fecha base
 * y su frecuencia. A diferencia de los servicios, un gasto fijo siempre es
 * recurrente (no existe la frecuencia "único"), así que siempre devuelve fecha.
 */
export function calcularProximoVencimiento(fechaBase: Date, frecuencia: FrecuenciaGasto): Date {
    const proximo = new Date(fechaBase);
    if (frecuencia === 'MENSUAL') proximo.setMonth(proximo.getMonth() + 1);
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
