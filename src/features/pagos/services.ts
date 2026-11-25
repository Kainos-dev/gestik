// src/features/pagos/services.ts
import { Moneda } from '@/lib/moneda';

/**
 * Convierte lo efectivamente pagado (montoPagado, en monedaPago) al monto
 * que se acredita al servicio/cargo (en monedaServicio). Si coinciden, no
 * hay conversión. Si no, tipoCambio se interpreta siempre como "cuántos
 * ARS vale 1 USD" (así es como se piensa el dólar en Argentina, sin
 * importar en qué dirección se esté convirtiendo) — mismo criterio y misma
 * fórmula que calcularMontoReposicion en deudas/services.ts, duplicado acá
 * a propósito: son features distintas y no hay necesidad real de
 * compartir código de negocio entre pagos y deudas.
 */
export function calcularMontoAcreditado(
    montoPagado: number,
    monedaPago: Moneda,
    monedaServicio: Moneda,
    tipoCambio: number | null | undefined
): number {
    if (monedaPago === monedaServicio) return montoPagado;

    if (!tipoCambio) {
        throw new Error('Falta el tipo de cambio para convertir el pago');
    }

    if (monedaServicio === 'USD' && monedaPago === 'ARS') return montoPagado / tipoCambio;
    if (monedaServicio === 'ARS' && monedaPago === 'USD') return montoPagado * tipoCambio;

    return montoPagado;
}

/**
 * Servicio en USD cobrado en pesos: la cotización no la escribe el usuario,
 * sale sola del dólar blue venta del día del cobro (ver resolverConversion
 * en pagos/actions.ts). El caso inverso (servicio en ARS cobrado en USD)
 * sigue con el tipo de cambio manual de siempre.
 */
export function usaCotizacionAutomatica(monedaServicio: Moneda, monedaPago: Moneda): boolean {
    return monedaServicio === 'USD' && monedaPago === 'ARS';
}

/**
 * Cuántos USD del servicio cubre un cobro de "montoArs" pesos al blue venta
 * "cotizacion", redondeado a centavos — lo que se muestra es exactamente lo
 * que queda guardado en pagos.monto. null si los datos no sirven (nunca un
 * número inventado).
 */
export function calcularEquivalenteUsd(montoArs: number, cotizacion: number): number | null {
    if (!Number.isFinite(montoArs) || montoArs <= 0) return null;
    if (!Number.isFinite(cotizacion) || cotizacion <= 0) return null;
    return Math.round((montoArs / cotizacion) * 100) / 100;
}

/** Saldo del servicio después de acreditar "equivalente" (sin bajar de 0). */
export function calcularSaldoRestante(saldoPendiente: number, equivalente: number): number {
    return Math.max(0, Math.round((saldoPendiente - equivalente) * 100) / 100);
}
