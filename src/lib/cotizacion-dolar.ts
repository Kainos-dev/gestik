// src/lib/cotizacion-dolar.ts
import { pool } from '@/lib/db';

// Cotización del dólar blue para pasar a pesos lo que entra o sale en USD.
// Se usa el valor de COMPRA: cuando les pagan en dólares y los cambian, es
// a ese precio que se los compran (el de venta es el que pagarías vos para
// comprarlos). Fuentes gratuitas, sin API key:
//   - argentinadatos.com: histórico día por día (desde 2011).
//   - dolarapi.com: la cotización de hoy, que el histórico puede tardar en tener.
// Todo se guarda en "cotizaciones_dolar_blue" y las queries leen de ahí
// (con sqlCotizacionBlueCompra), nunca de la API directo: así un mes
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
 */
export async function actualizarCotizacionesBlue(): Promise<void> {
    const ahora = Date.now();
    if (ahora - (globalParaCotizacion.ultimaSyncCotizacionBlue ?? 0) < INTERVALO_MS) return;
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
 * Subconsulta SQL con el blue compra vigente en la fecha "expresionFecha"
 * (la del último día con cotización hasta esa fecha inclusive — fines de
 * semana y feriados toman la del último día hábil). NULL si la tabla no
 * tiene nada hasta esa fecha.
 */
export function sqlCotizacionBlueCompra(expresionFecha: string): string {
    return `(SELECT cb.compra FROM cotizaciones_dolar_blue cb WHERE cb.fecha <= (${expresionFecha})::date ORDER BY cb.fecha DESC LIMIT 1)`;
}
