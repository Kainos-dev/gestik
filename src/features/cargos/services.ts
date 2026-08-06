// src/features/cargos/services.ts
import { EstadoCargo } from './types';

/**
 * Calcula el estado "real" a mostrar en la UI a partir de cuánto se cubrió
 * de un cargo (via pagos) y si ya venció el período. PAGADO nunca cambia por
 * fecha; PENDIENTE/PARCIAL pasan a VENCIDO cuando el período ya pasó.
 */
export function calcularEstadoCargo(monto: number, montoCubierto: number, periodo: Date): EstadoCargo {
    if (montoCubierto >= monto) return 'PAGADO';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaPeriodo = new Date(periodo);
    fechaPeriodo.setHours(0, 0, 0, 0);

    if (fechaPeriodo < hoy) return 'VENCIDO';
    return montoCubierto > 0 ? 'PARCIAL' : 'PENDIENTE';
}
