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
    gastosDeudasArs: number;
    ahorroMesArs: number;
}

/**
 * Reparte el Facturado de un mes, ya todo en pesos (lo facturado en ARS más
 * lo facturado en USD pasado a pesos con el blue compra — ver
 * getFacturadoDelMes), en sueldos (30%), la cuenta de gastos fijos y deudas
 * (30%) y ahorro (40%). Antes sueldos y gastos-deudas quedaban separados por
 * moneda; desde que los USD se convierten solos, todo el reparto es en pesos
 * (las columnas *_usd de repartos_mensuales quedan en 0).
 */
export function calcularReparto(facturadoTotalArs: number): RepartoCalculado {
    return {
        sueldosArs: facturadoTotalArs * PORCENTAJE_SUELDOS,
        gastosDeudasArs: facturadoTotalArs * PORCENTAJE_GASTOS_DEUDAS,
        ahorroMesArs: facturadoTotalArs * PORCENTAJE_AHORRO,
    };
}
