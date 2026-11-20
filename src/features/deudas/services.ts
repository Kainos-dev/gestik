// src/features/deudas/services.ts
import { MONEDAS, Moneda } from '@/lib/moneda';
import { EstadoDeuda } from './types';

/**
 * Cuánto falta reponer, separado por moneda (nunca se convierte ni se
 * mezcla ARS con USD). Sólo suma deudas no eliminadas, cada una por lo que
 * le falta (montoTotal − montoRepuesto, mínimo 0): una saldada aporta 0 y una
 * sobrepagada no compensa a otra — mismo criterio que total_pendiente en
 * getTotalesDeudas (deudas/queries.ts).
 */
export function calcularPendientePorMoneda(
    deudas: { montoTotal: number; montoRepuesto: number; moneda: Moneda; eliminadaAt: Date | null }[]
): Record<Moneda, number> {
    const pendiente = Object.fromEntries(MONEDAS.map((m) => [m, 0])) as Record<Moneda, number>;
    for (const d of deudas) {
        if (d.eliminadaAt !== null) continue;
        pendiente[d.moneda] += Math.max(0, d.montoTotal - d.montoRepuesto);
    }
    // Redondeo a centavos para que la suma de decimales no muestre 0,000001.
    for (const m of MONEDAS) pendiente[m] = Math.round(pendiente[m] * 100) / 100;
    return pendiente;
}

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
