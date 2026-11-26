// src/lib/cotizacion-cripto.ts
// Dólar cripto VENTA como estimación del costo de comprar dólares en ARQ, para
// pasar a pesos los gastos fijos que pagamos en USD.
//
// Por qué cripto venta: ARQ (antes DolarApp) no publica API ni cotización
// propia; su precio de compra sigue de cerca al dólar cripto (26/11/2026: ARQ
// $1.761,88 vs. cripto venta $1.762,96). En DolarAPI, "venta" es lo que se paga
// en pesos por cada dólar que uno compra (y "compra", lo que te dan por cada
// dólar que vendés): como nosotros compramos dólares entregando pesos, es venta.
//
// Sólo para ESTIMAR gastos fijos en USD. Los cobros de clientes, las
// reposiciones de deuda y los movimientos reales de caja siguen con el dólar
// blue venta (src/lib/cotizacion-dolar.ts) y no se tocan.
import { pool } from '@/lib/db';

export const URL_DOLAR_CRIPTO = 'https://dolarapi.com/v1/dolares/cripto';
const TIMEOUT_MS = 10_000;
// Un valor guardado de hace menos de esto se usa sin volver a consultar la API.
export const VIGENCIA_MS = 30 * 60 * 1000;
// Un dato publicado por la fuente hace más de esto se marca como desactualizado
// aunque la API responda (el dólar cripto opera todos los días, todo el día).
export const MAX_ANTIGUEDAD_FUENTE_MS = 24 * 60 * 60 * 1000;
// Si la API falla, no se reintenta en cada render: como mucho una vez por minuto.
const REINTENTO_MS = 60 * 1000;

export interface CotizacionCripto {
    venta: number; // pesos por cada dólar que se compra
    actualizadaAt: string; // ISO: cuándo la publicó la fuente
    // La API no respondió y se usa el último valor guardado, o la fuente publicó
    // el dato hace más de 24 horas.
    desactualizada: boolean;
}

export interface FilaCotizacionCripto {
    venta: number;
    actualizadaAt: Date;
    obtenidaAt: Date;
}

/** Valida la respuesta de DolarAPI: venta y compra positivas y una fecha válida. Nunca inventa valores. */
export function parsearRespuestaCripto(json: unknown): { compra: number; venta: number; actualizadaAt: Date } | null {
    if (!json || typeof json !== 'object') return null;
    const r = json as Record<string, unknown>;
    const compra = Number(r.compra);
    const venta = Number(r.venta);
    const actualizadaAt = new Date(String(r.fechaActualizacion));
    if (r.casa !== 'cripto') return null;
    if (!Number.isFinite(compra) || compra <= 0 || !Number.isFinite(venta) || venta <= 0) return null;
    if (Number.isNaN(actualizadaAt.getTime())) return null;
    return { compra, venta, actualizadaAt };
}

/** ¿Hay que volver a consultar la API? Sí si no hay nada guardado o lo guardado tiene más de VIGENCIA_MS. */
export function necesitaActualizar(ultima: FilaCotizacionCripto | null, ahora: Date): boolean {
    return !ultima || ahora.getTime() - ultima.obtenidaAt.getTime() > VIGENCIA_MS;
}

/**
 * Lo que se muestra: el último valor guardado; "desactualizada" si había que
 * renovarlo y la API no respondió (o si la fuente lo publicó hace más de 24 h).
 * null si nunca hubo ninguno (no disponible).
 */
export function evaluarCotizacion(
    ultima: FilaCotizacionCripto | null,
    { ahora, fallo }: { ahora: Date; fallo: boolean }
): CotizacionCripto | null {
    if (!ultima) return null;
    return {
        venta: ultima.venta,
        actualizadaAt: ultima.actualizadaAt.toISOString(),
        desactualizada:
            (fallo && necesitaActualizar(ultima, ahora)) ||
            ahora.getTime() - ultima.actualizadaAt.getTime() > MAX_ANTIGUEDAD_FUENTE_MS,
    };
}

async function leerUltima(): Promise<FilaCotizacionCripto | null> {
    const { rows } = await pool.query(
        `SELECT venta, actualizada_at, obtenida_at FROM cotizaciones_dolar_cripto ORDER BY actualizada_at DESC LIMIT 1`
    );
    if (!rows[0]) return null;
    return { venta: Number(rows[0].venta), actualizadaAt: rows[0].actualizada_at, obtenidaAt: rows[0].obtenida_at };
}

async function traerDeLaApi(fetcher: typeof fetch): Promise<{ compra: number; venta: number; actualizadaAt: Date }> {
    const res = await fetcher(URL_DOLAR_CRIPTO, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${URL_DOLAR_CRIPTO} respondió ${res.status}`);
    const parsed = parsearRespuestaCripto(await res.json());
    if (!parsed) throw new Error('Respuesta de DolarAPI (cripto) inválida');
    return parsed;
}

const estado = globalThis as unknown as { ultimoFalloCripto?: number };

/**
 * Cotización estimada de ARQ (dólar cripto venta). Reutiliza el último valor
 * guardado si tiene menos de 30 minutos; si no, consulta DolarAPI y lo guarda.
 * Si la API falla devuelve el último valor válido marcado como desactualizado,
 * y si no hay ninguno, null. Nunca tira.
 */
export async function obtenerCotizacionCripto({
    fetcher = fetch,
    ahora = new Date(),
}: { fetcher?: typeof fetch; ahora?: Date } = {}): Promise<CotizacionCripto | null> {
    let ultima: FilaCotizacionCripto | null = null;
    try {
        ultima = await leerUltima();
    } catch (error) {
        console.error('No se pudo leer la cotización del dólar cripto guardada:', error);
        return null;
    }
    if (!necesitaActualizar(ultima, ahora)) return evaluarCotizacion(ultima, { ahora, fallo: false });

    // Si la API falló hace menos de un minuto, no se reintenta todavía.
    if (estado.ultimoFalloCripto && ahora.getTime() - estado.ultimoFalloCripto < REINTENTO_MS) {
        return evaluarCotizacion(ultima, { ahora, fallo: true });
    }

    try {
        const nueva = await traerDeLaApi(fetcher);
        // Si la fuente no publicó nada nuevo, sólo se renueva cuándo se consultó.
        await pool.query(
            `INSERT INTO cotizaciones_dolar_cripto (compra, venta, actualizada_at, obtenida_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (actualizada_at) DO UPDATE SET obtenida_at = EXCLUDED.obtenida_at`,
            [nueva.compra, nueva.venta, nueva.actualizadaAt, ahora]
        );
        estado.ultimoFalloCripto = undefined;
        return evaluarCotizacion(await leerUltima(), { ahora, fallo: false });
    } catch (error) {
        estado.ultimoFalloCripto = ahora.getTime();
        console.error('No se pudo obtener el dólar cripto de DolarAPI:', error);
        return evaluarCotizacion(ultima, { ahora, fallo: true });
    }
}
