// src/features/balance-mensual/services.ts

// Porcentajes fijos del reparto mensual (pedido del equipo, no configurable
// por ahora). Suman 1 a propósito — si se cambian, que se mantenga así, y
// recalcular con una migración los repartos ya guardados (ver
// migrations/…recalcular-repartos-30-30-40.js), para que los porcentajes
// que muestra el panel sigan correspondiendo a los montos.
export const PORCENTAJE_SUELDOS = 0.3;
export const PORCENTAJE_GASTOS_DEUDAS = 0.3;
export const PORCENTAJE_AHORRO = 0.4;

export interface RepartoCalculado {
    sueldosArs: number;
    sueldosUsd: number;
    gastosDeudasArs: number;
    gastosDeudasUsd: number;
    ahorroMesArs: number;
}

/**
 * Reparte el Facturado de un mes (ya separado por moneda) en sueldos (30%),
 * la cuenta de gastos fijos y deudas (30%) y ahorro (40%). Sueldos y
 * gastos-deudas quedan separados por moneda, sin convertir; el ahorro SÍ se
 * funde en una sola cifra en pesos (se guarda en reservas de Mercado Pago),
 * así que la porción de ahorro en USD necesita "tipoCambio" (ARS por USD)
 * para poder sumarse — si facturadoUsd es 0, tipoCambio puede ser null/
 * undefined sin problema (no hay nada que convertir).
 */
export function calcularReparto(
    facturadoArs: number,
    facturadoUsd: number,
    tipoCambio: number | null | undefined
): RepartoCalculado {
    if (facturadoUsd > 0 && !tipoCambio) {
        throw new Error('Falta el tipo de cambio para repartir el Facturado en USD de este mes');
    }

    const ahorroUsdEnPesos = facturadoUsd > 0 ? facturadoUsd * PORCENTAJE_AHORRO * (tipoCambio as number) : 0;

    return {
        sueldosArs: facturadoArs * PORCENTAJE_SUELDOS,
        sueldosUsd: facturadoUsd * PORCENTAJE_SUELDOS,
        gastosDeudasArs: facturadoArs * PORCENTAJE_GASTOS_DEUDAS,
        gastosDeudasUsd: facturadoUsd * PORCENTAJE_GASTOS_DEUDAS,
        ahorroMesArs: facturadoArs * PORCENTAJE_AHORRO + ahorroUsdEnPesos,
    };
}
