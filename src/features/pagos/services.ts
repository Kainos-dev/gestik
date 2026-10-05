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
