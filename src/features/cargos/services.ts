// src/features/cargos/services.ts
import { EstadoCargo } from './types';

/**
 * Calcula el estado "real" a mostrar en la UI a partir de cuánto se cubrió
 * de un cargo (via pagos) y si ya pasó su vencimiento. PAGADO nunca cambia
 * por fecha; PENDIENTE/PARCIAL pasan a VENCIDO cuando "vencimiento" ya pasó.
 * "vencimiento" es el inicio del PRÓXIMO período (no el "periodo" del cargo
 * en sí) — así el cargo se mantiene PENDIENTE/PARCIAL durante todo su ciclo
 * de facturación y sólo se marca atrasado cuando arrancaría el siguiente.
 */
export function calcularEstadoCargo(monto: number, montoCubierto: number, vencimiento: Date): EstadoCargo {
    if (montoCubierto >= monto) return 'PAGADO';

    // "vencimiento" se guarda como medianoche UTC del día elegido (igual
    // criterio que formatDate usa para mostrarlo), así que hay que leerlo con
    // los getters UTC acá también — truncar con setHours() local lo corre un
    // día para atrás en timezones negativos (ej. Argentina).
    const fechaVencimiento = new Date(vencimiento);
    const vencimientoUTC = Date.UTC(
        fechaVencimiento.getUTCFullYear(),
        fechaVencimiento.getUTCMonth(),
        fechaVencimiento.getUTCDate(),
    );

    const hoy = new Date();
    const hoyLocal = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    if (vencimientoUTC < hoyLocal) return 'VENCIDO';
    return montoCubierto > 0 ? 'PARCIAL' : 'PENDIENTE';
}
