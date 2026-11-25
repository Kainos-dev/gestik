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

// ─── Anulación y restauración ───────────────────────────────────────────────

/** Lo mínimo del cobro archivado que hace falta para decidir si se puede restaurar. */
export interface CobroArchivado {
    clienteId: string;
    servicioId: string | null;
    moneda: Moneda; // moneda en la que se acreditó al servicio
}

/** Estado actual de la base, consultado dentro de la transacción de restauración. */
export interface ContextoRestauracion {
    yaRestaurado: boolean;
    cobroYaActivo: boolean; // existe en pagos una fila con el mismo id
    clienteExiste: boolean;
    servicio: { clienteId: string; moneda: Moneda } | null; // null si no existe (o el cobro no tenía)
    hayCobroIgualActivo: boolean; // mismo cliente/servicio/fecha/monto/moneda: probablemente se volvió a cargar
}

/**
 * Decide si restaurar un cobro anulado es seguro. Restaurar lo vuelve a
 * insertar tal cual (mismo monto acreditado y misma cotización histórica),
 * así que se rechaza cualquier situación en la que eso lo contaría dos veces
 * o lo acreditaría en una moneda que el servicio ya no usa.
 */
export function evaluarRestauracion(
    cobro: CobroArchivado,
    ctx: ContextoRestauracion
): { ok: true } | { ok: false; error: string } {
    if (ctx.yaRestaurado || ctx.cobroYaActivo) return { ok: false, error: 'Ese cobro ya está restaurado' };
    if (!ctx.clienteExiste) return { ok: false, error: 'El cliente del cobro ya no existe' };
    if (cobro.servicioId) {
        if (!ctx.servicio) return { ok: false, error: 'El servicio del cobro ya no existe. Registralo de nuevo sin servicio.' };
        if (ctx.servicio.clienteId !== cobro.clienteId) {
            return { ok: false, error: 'El servicio del cobro ahora pertenece a otro cliente' };
        }
        if (ctx.servicio.moneda !== cobro.moneda) {
            return {
                ok: false,
                error: `El servicio ahora se cobra en ${ctx.servicio.moneda} y el cobro se acreditó en ${cobro.moneda}. Registralo de nuevo.`,
            };
        }
    }
    if (ctx.hayCobroIgualActivo) {
        return {
            ok: false,
            error: 'Ya hay un cobro igual activo (mismo cliente, servicio, fecha y monto). Restaurarlo lo contaría dos veces.',
        };
    }
    return { ok: true };
}
