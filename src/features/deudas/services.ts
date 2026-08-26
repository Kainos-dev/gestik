// src/features/deudas/services.ts
import { Moneda } from '@/lib/moneda';
import { EstadoDeuda } from './types';

/**
 * Estado calculado (no persistido) a partir de cuánto se repuso de una
 * deuda — mismo criterio que calcularEstadoCargo en cargos/services.ts.
 */
export function calcularEstadoDeuda(montoTotal: number, montoRepuesto: number): EstadoDeuda {
    return montoRepuesto >= montoTotal ? 'SALDADA' : 'ACTIVA';
}

/**
 * Convierte lo efectivamente pagado (montoPagado, en monedaPago) al monto
 * que se acredita a la deuda (en monedaDeuda). Si coinciden, no hay
 * conversión. Si no, tipoCambio se interpreta siempre como "cuántos ARS
 * vale 1 USD" (así es como se piensa el dólar en Argentina, sin importar
 * en qué dirección se esté convirtiendo).
 */
export function calcularMontoReposicion(
    montoPagado: number,
    monedaPago: Moneda,
    monedaDeuda: Moneda,
    tipoCambio: number | null | undefined
): number {
    if (monedaPago === monedaDeuda) return montoPagado;

    if (!tipoCambio) {
        throw new Error('Falta el tipo de cambio para convertir la reposición');
    }

    if (monedaDeuda === 'USD' && monedaPago === 'ARS') return montoPagado / tipoCambio;
    if (monedaDeuda === 'ARS' && monedaPago === 'USD') return montoPagado * tipoCambio;

    return montoPagado;
}
