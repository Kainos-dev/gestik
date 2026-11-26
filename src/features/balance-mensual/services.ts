// src/features/balance-mensual/services.ts

// Reparto mensual de lo Facturado. Sueldos es configurable con vigencia
// (tabla porcentajes_sueldo, ver porcentajeVigente); gastos fijos y deudas
// sigue en 30%, y el ahorro es lo que sobra (40% con el sueldo en 30%).
// Cada reparto guarda el porcentaje con que se calculó (porcentaje_sueldos),
// así un cambio nunca reescribe un mes ya cerrado.
export const PORCENTAJE_SUELDOS_POR_DEFECTO = 30; // en puntos (30 = 30%)
export const PORCENTAJE_GASTOS_DEUDAS = 0.3;
export const PORCENTAJE_SUELDOS_MAXIMO = 70; // gastos (30%) + sueldos no pueden pasar el 100%

export interface RepartoCalculado {
    sueldosArs: number;
    gastosDeudasArs: number;
    ahorroMesArs: number;
}

/**
 * Reparte el Facturado de un mes, ya todo en pesos (lo facturado en ARS más
 * lo facturado en USD pasado a pesos con el blue venta — ver
 * getFacturadoDelMes), en sueldos (porcentajeSueldos, en puntos: 30 = 30%),
 * la cuenta de gastos fijos y deudas (30%) y ahorro (el resto). Con 30% da
 * exactamente el 30/30/40 de siempre.
 */
export function calcularReparto(
    facturadoTotalArs: number,
    porcentajeSueldos: number = PORCENTAJE_SUELDOS_POR_DEFECTO
): RepartoCalculado {
    if (!(porcentajeSueldos > 0) || porcentajeSueldos > PORCENTAJE_SUELDOS_MAXIMO) {
        throw new Error(`Porcentaje de sueldos inválido: ${porcentajeSueldos}`);
    }
    const sueldosArs = (facturadoTotalArs * porcentajeSueldos) / 100;
    const gastosDeudasArs = facturadoTotalArs * PORCENTAJE_GASTOS_DEUDAS;
    return { sueldosArs, gastosDeudasArs, ahorroMesArs: facturadoTotalArs - sueldosArs - gastosDeudasArs };
}

// ─── Porcentaje de sueldos con vigencia ─────────────────────────────────────

export interface PorcentajeSueldo {
    porcentaje: number; // en puntos (30 = 30%)
    vigenteDesde: Date; // siempre el día 1 de un mes, a medianoche UTC
}

/** Primer día del mes de "fecha", a medianoche UTC. */
export function inicioDeMesUtc(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

/**
 * Porcentaje de sueldos que corresponde al mes de "mes": el de la última
 * vigencia que arrancó en ese mes o antes. Sin ninguna, el 30% de siempre.
 */
export function porcentajeVigente(historial: PorcentajeSueldo[], mes: Date): number {
    const inicio = inicioDeMesUtc(mes).getTime();
    let vigente: PorcentajeSueldo | null = null;
    for (const p of historial) {
        const desde = inicioDeMesUtc(p.vigenteDesde).getTime();
        if (desde <= inicio && (!vigente || desde > inicioDeMesUtc(vigente.vigenteDesde).getTime())) vigente = p;
    }
    return vigente?.porcentaje ?? PORCENTAJE_SUELDOS_POR_DEFECTO;
}

/**
 * Valida un cambio de porcentaje. Se aplica desde el mes de la fecha elegida
 * (el reparto es mensual), y ese mes no puede tener ya su reparto cerrado:
 * así un cambio nunca altera un período anterior. Devuelve el mes desde el
 * que rige.
 */
export function validarCambioPorcentaje(
    porcentaje: number,
    fecha: Date,
    ultimoMesCerrado: Date | null
): { ok: true; vigenteDesde: Date } | { ok: false; error: string } {
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > PORCENTAJE_SUELDOS_MAXIMO) {
        return { ok: false, error: `El porcentaje tiene que ser mayor a 0 y como máximo ${PORCENTAJE_SUELDOS_MAXIMO}%` };
    }
    const vigenteDesde = inicioDeMesUtc(fecha);
    if (ultimoMesCerrado && vigenteDesde.getTime() <= inicioDeMesUtc(ultimoMesCerrado).getTime()) {
        const siguiente = new Date(Date.UTC(ultimoMesCerrado.getUTCFullYear(), ultimoMesCerrado.getUTCMonth() + 1, 1));
        return {
            ok: false,
            error: `Ese mes ya tiene el reparto cerrado. Elegí una fecha desde ${String(siguiente.getUTCMonth() + 1).padStart(2, '0')}/${siguiente.getUTCFullYear()}.`,
        };
    }
    return { ok: true, vigenteDesde };
}
