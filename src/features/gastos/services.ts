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

/**
 * Totales de los gastos fijos ACTIVOS, separados por moneda y por período:
 * "mensual" junta MENSUAL y MENSUAL_30_DIAS (los dos se pagan una vez por
 * mes) y "anual" los ANUAL aparte, para no mezclar en un mismo número montos
 * que se pagan una vez por mes con montos que se pagan una vez por año.
 */
export function calcularTotalesGastosFijosActivos(gastosFijos: GastoFijo[]): {
    mensual: TotalPorMoneda[];
    anual: TotalPorMoneda[];
} {
    const activos = gastosFijos.filter((gastoFijo) => gastoFijo.estado === 'ACTIVO');
    return {
        mensual: calcularTotalPorMoneda(activos.filter((gastoFijo) => gastoFijo.frecuencia !== 'ANUAL')),
        anual: calcularTotalPorMoneda(activos.filter((gastoFijo) => gastoFijo.frecuencia === 'ANUAL')),
    };
}

// ─── Gastos fijos del mes en pesos (Gastos → Gastos fijos y Balance Mensual) ─

export interface GastoFijoEnPesos {
    gastoFijo: GastoFijo;
    // Equivalente en pesos: el monto si es ARS, monto × dólar cripto venta si es USD.
    // null = gasto en USD y no hay cotización: no se inventa un valor.
    montoArs: number | null;
}

export interface GastosFijosDelMes {
    mensuales: GastoFijoEnPesos[]; // MENSUAL y MENSUAL_30_DIAS: se pagan una vez por mes
    anuales: GastoFijoEnPesos[]; // aparte, para no inflar el total mensual
    totalMensualArs: number; // suma de los mensuales con equivalente en pesos
    usdSinConvertir: number; // USD mensuales que no se pudieron pasar a pesos (falta cotización)
    porMoneda: TotalPorMoneda[]; // los mensuales en su moneda original
}

/** Equivalente en pesos de un monto: tal cual si es ARS; con pesosPorDolar si es USD (null sin cotización). */
export function equivalenteEnPesos(monto: number, moneda: Moneda, pesosPorDolar: number | null): number | null {
    if (moneda === 'ARS') return monto;
    if (pesosPorDolar === null || !Number.isFinite(pesosPorDolar) || pesosPorDolar <= 0) return null;
    return Math.round(monto * pesosPorDolar * 100) / 100;
}

/**
 * Gastos fijos que corresponden al mes de "mes" (en UTC): ACTIVOS y que ya
 * empezaron antes de que termine ese mes. Los USD se pasan a pesos con
 * "pesosPorDolar" (el dólar cripto venta, costo aproximado de comprarlos en ARQ —
 * ver src/lib/cotizacion-cripto.ts): es un ESTIMADO que se recalcula con
 * cada cotización nueva, sin tocar el monto original en USD ni los gastos ya
 * pagados (esos quedan en la tabla gastos con su propio valor).
 */
export function calcularGastosFijosDelMes(
    gastosFijos: GastoFijo[],
    mes: Date,
    pesosPorDolar: number | null
): GastosFijosDelMes {
    const inicioMesSiguiente = Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1);
    const vigentes = gastosFijos.filter(
        (g) => g.estado === 'ACTIVO' && new Date(g.fechaInicio).getTime() < inicioMesSiguiente
    );
    const enPesos = (g: GastoFijo): GastoFijoEnPesos => ({ gastoFijo: g, montoArs: equivalenteEnPesos(g.monto, g.moneda, pesosPorDolar) });

    const mensuales = vigentes.filter((g) => g.frecuencia !== 'ANUAL').map(enPesos);
    const anuales = vigentes.filter((g) => g.frecuencia === 'ANUAL').map(enPesos);
    const centavos = (n: number) => Math.round(n * 100) / 100;

    return {
        mensuales,
        anuales,
        totalMensualArs: centavos(mensuales.reduce((s, g) => s + (g.montoArs ?? 0), 0)),
        usdSinConvertir: centavos(mensuales.filter((g) => g.montoArs === null).reduce((s, g) => s + g.gastoFijo.monto, 0)),
        porMoneda: calcularTotalPorMoneda(mensuales.map((g) => g.gastoFijo)),
    };
}
