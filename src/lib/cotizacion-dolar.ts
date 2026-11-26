// src/lib/cotizacion-dolar.ts
import { pool } from '@/lib/db';

// Cotización del dólar blue para pasar a pesos lo que entra o sale en USD.
// Se usa el valor de VENTA (el más caro de los dos), por decisión del
// equipo — hasta oct 2026 se usaba el de compra. Fuentes gratuitas, sin API key:
//   - argentinadatos.com: histórico día por día (desde 2011).
//   - dolarapi.com: la cotización de hoy, que el histórico puede tardar en tener.
// Todo se guarda en "cotizaciones_dolar_blue" y las queries leen de ahí
// (con sqlCotizacionBlueVenta), nunca de la API directo: así un mes
// cerrado no cambia sus números y la app sigue andando si la API se cae.
const URL_HISTORICO = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/blue';
const URL_HOY = 'https://dolarapi.com/v1/dolares/blue';
const TIMEOUT_MS = 10_000;

// Como mucho una sincronización cada 10 minutos por proceso — se llama en
// cada render de Balance Mensual y no hace falta pegarle a la base/API cada vez.
const INTERVALO_MS = 10 * 60 * 1000;
const globalParaCotizacion = globalThis as unknown as { ultimaSyncCotizacionBlue?: number };

interface CotizacionApi {
    fecha: string; // YYYY-MM-DD
    compra: number;
    venta: number;
}

async function traerJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
    return res.json() as Promise<T>;
}

async function guardar(cotizaciones: CotizacionApi[], pisarExistentes: boolean) {
    if (cotizaciones.length === 0) return;
    await pool.query(
        `INSERT INTO cotizaciones_dolar_blue (fecha, compra, venta)
     SELECT * FROM unnest($1::date[], $2::numeric[], $3::numeric[])
     ON CONFLICT (fecha) DO ${pisarExistentes ? 'UPDATE SET compra = EXCLUDED.compra, venta = EXCLUDED.venta' : 'NOTHING'}`,
        [cotizaciones.map((c) => c.fecha), cotizaciones.map((c) => c.compra), cotizaciones.map((c) => c.venta)]
    );
}

/**
 * Completa "cotizaciones_dolar_blue" hasta hoy. Si faltan días anteriores
 * a hoy (tabla vacía, o la app estuvo sin usarse) baja el histórico entero
 * (una sola request) e inserta lo que falte, sin pisar días ya guardados —
 * un día cerrado nunca cambia. La de hoy sale de dolarapi y sí se pisa,
 * porque se va actualizando durante el día. Nunca tira: si una API falla se
 * sigue con lo que ya hay guardado (ver faltaCotizacion en los consumidores).
 *
 * intervaloMs permite acortar el throttle cuando hace falta una cotización
 * puntual que no está guardada (ej. una reposición de deuda en otra moneda,
 * donde el usuario puede tocar "Reintentar" si la API falló).
 */
export async function actualizarCotizacionesBlue({ intervaloMs = INTERVALO_MS }: { intervaloMs?: number } = {}): Promise<void> {
    const ahora = Date.now();
    if (ahora - (globalParaCotizacion.ultimaSyncCotizacionBlue ?? 0) < intervaloMs) return;
    globalParaCotizacion.ultimaSyncCotizacionBlue = ahora;

    try {
        const { rows } = await pool.query(
            `SELECT MAX(fecha) < CURRENT_DATE - 1 OR MAX(fecha) IS NULL AS faltan_dias FROM cotizaciones_dolar_blue`
        );
        if (rows[0].faltan_dias) {
            const historico = await traerJson<CotizacionApi[]>(URL_HISTORICO);
            await guardar(historico, false);
        }
    } catch (error) {
        console.error('No se pudo actualizar el histórico del dólar blue:', error);
    }

    try {
        const hoy = await traerJson<{ compra: number; venta: number; fechaActualizacion: string }>(URL_HOY);
        await guardar([{ fecha: hoy.fechaActualizacion.slice(0, 10), compra: hoy.compra, venta: hoy.venta }], true);
    } catch (error) {
        console.error('No se pudo obtener la cotización de hoy del dólar blue:', error);
    }
}

/**
 * Subconsulta SQL con el blue venta vigente en la fecha "expresionFecha"
 * (la del último día con cotización hasta esa fecha inclusive — fines de
 * semana y feriados toman la del último día hábil). NULL si la tabla no
 * tiene nada hasta esa fecha.
 */
export function sqlCotizacionBlueVenta(expresionFecha: string): string {
    return `(SELECT cb.venta FROM cotizaciones_dolar_blue cb WHERE cb.fecha <= (${expresionFecha})::date ORDER BY cb.fecha DESC LIMIT 1)`;
}

// ─── Cotización puntual para registrar un movimiento en otra moneda ─────────
// (reposiciones de deuda, cobros en pesos de servicios en USD)

// Fines de semana y feriados usan el último día hábil guardado (mismo
// criterio que sqlCotizacionBlueVenta). Más atrás que esto se considera que
// la cotización no está disponible, en vez de aplicar una vieja.
const MAX_DIAS_SIN_COTIZACION = 5;
// Si falta la cotización, se reintenta la API como mucho una vez por minuto.
const INTERVALO_REINTENTO_MS = 60 * 1000;

export type ResultadoCotizacion =
    | { ok: true; venta: number; fecha: string }
    | { ok: false; error: string };

async function leerCotizacionGuardada(fecha: string): Promise<{ venta: number; fecha: string } | null> {
    const { rows } = await pool.query(
        `SELECT fecha::text AS fecha, venta
     FROM cotizaciones_dolar_blue
     WHERE fecha <= $1::date AND fecha >= $1::date - $2::int AND venta > 0
     ORDER BY fecha DESC
     LIMIT 1`,
        [fecha, MAX_DIAS_SIN_COTIZACION]
    );
    if (!rows[0]) return null;
    const venta = Number(rows[0].venta);
    return Number.isFinite(venta) && venta > 0 ? { venta, fecha: rows[0].fecha } : null;
}

/**
 * Dólar blue VENTA vigente para la fecha "YYYY-MM-DD", reutilizando la misma
 * tabla/integración que Balance Mensual (cotizaciones_dolar_blue +
 * actualizarCotizacionesBlue). Si no está guardada la del propio día, intenta
 * traerla de la API; si sigue sin haber una válida, devuelve error — nunca
 * una cotización inventada ni 0. Sólo para usar desde el servidor: quien
 * registra el movimiento la vuelve a resolver acá en vez de confiar en la
 * que mostró el formulario.
 */
export async function resolverCotizacionBlue(fecha: string): Promise<ResultadoCotizacion> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'Fecha inválida' };

    let cotizacion = await leerCotizacionGuardada(fecha);

    if (!cotizacion || cotizacion.fecha < fecha) {
        await actualizarCotizacionesBlue({ intervaloMs: INTERVALO_REINTENTO_MS });
        cotizacion = (await leerCotizacionGuardada(fecha)) ?? cotizacion;
    }

    if (!cotizacion) {
        return {
            ok: false,
            error: 'No se pudo obtener la cotización del dólar blue para esa fecha. Probá de nuevo en un minuto.',
        };
    }
    return { ok: true, ...cotizacion };
}
