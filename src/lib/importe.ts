// src/lib/importe.ts
// Interpretación de importes escritos a mano, con formato argentino.
//
// Los inputs de importe son de texto (no type="number"): en un input numérico
// el navegador decide según su idioma qué es "100.000" y puede llegar como
// 100. Acá se interpreta siempre igual, en el navegador y en el servidor:
//
//   100000 → 100000      100.000 → 100000      1.000.000 → 1000000
//   1500,50 → 1500.5     1.500,50 → 1500.5     1500.50 → 1500.5
//
// - La coma es SIEMPRE el separador decimal.
// - El punto es separador de miles cuando agrupa de a 3 cifras ("1.500",
//   "1.000.000"). Si no agrupa de a 3 ("1500.50", "2.5") es decimal, porque
//   ahí no hay otra lectura posible.
// - Lo que no se puede leer sin adivinar ("1,500.50", "1.50.000", "1,2,3",
//   "12.34.5") se rechaza con un error en vez de convertirse en cualquier cosa.
// Nunca se hace parseFloat/Number sobre el texto original: primero se valida
// con estas reglas y recién después se convierte la versión normalizada.
import { z } from 'zod';

export type ResultadoImporte = { ok: true; valor: number } | { ok: false; error: string };

export interface OpcionesImporte {
    /** Máximo de decimales admitidos (2 para montos, 4 para un tipo de cambio). */
    decimales?: number;
}

const MILES_AR = /^\d{1,3}(\.\d{3})+$/; // 1.500 · 1.000.000
const MILES_AR_CON_DECIMALES = /^\d{1,3}(\.\d{3})+,\d+$/; // 1.500,50
const ENTERO = /^\d+$/;
const DECIMAL_COMA = /^\d+,\d+$/; // 1500,50
const DECIMAL_PUNTO = /^\d+\.\d+$/; // 1500.50

const ERROR_FORMATO = 'Importe inválido. Escribilo como 150000, 150.000 o 150.000,50';

function contarDecimales(normalizado: string): number {
    const punto = normalizado.indexOf('.');
    return punto === -1 ? 0 : normalizado.length - punto - 1;
}

/** Normaliza el texto a "1234.56" (sin miles, punto decimal) o null si no se puede leer sin ambigüedad. */
function normalizar(texto: string): string | null {
    if (ENTERO.test(texto)) return texto;
    if (MILES_AR.test(texto)) {
        // "0.500" o "012.345" no son miles bien escritos.
        if (texto.startsWith('0')) return null;
        return texto.replace(/\./g, '');
    }
    if (MILES_AR_CON_DECIMALES.test(texto)) {
        if (texto.startsWith('0')) return null;
        return texto.replace(/\./g, '').replace(',', '.');
    }
    if (DECIMAL_COMA.test(texto)) return texto.replace(',', '.');
    // Un solo punto que no agrupa de a 3 (si agrupara, ya lo tomó MILES_AR).
    if (DECIMAL_PUNTO.test(texto)) return texto;
    return null;
}

export function parsearImporte(entrada: unknown, { decimales = 2 }: OpcionesImporte = {}): ResultadoImporte {
    if (typeof entrada === 'number') {
        if (!Number.isFinite(entrada)) return { ok: false, error: ERROR_FORMATO };
        // Un número que ya llega como número (ej. un valor precargado) sólo
        // se valida: no puede traer más decimales de los admitidos.
        const escala = 10 ** decimales;
        if (Math.abs(Math.round(entrada * escala) - entrada * escala) > 1e-6) {
            return { ok: false, error: `Usá como máximo ${decimales} decimales` };
        }
        return { ok: true, valor: entrada };
    }
    if (typeof entrada !== 'string') return { ok: false, error: 'Ingresá un importe' };

    // Se toleran espacios y el signo de la moneda ("$ 150.000", "US$ 100").
    let texto = entrada.trim().replace(/^(US\$|U\$S|\$)/i, '').replace(/\s+/g, '');
    if (texto === '') return { ok: false, error: 'Ingresá un importe' };

    let negativo = false;
    if (texto.startsWith('-')) {
        negativo = true;
        texto = texto.slice(1);
    }

    const normalizado = normalizar(texto);
    if (normalizado === null) return { ok: false, error: ERROR_FORMATO };
    if (contarDecimales(normalizado) > decimales) {
        return { ok: false, error: `Usá como máximo ${decimales} decimales` };
    }

    const valor = Number(normalizado);
    if (!Number.isFinite(valor) || valor > 1e12) return { ok: false, error: 'Importe fuera de rango' };
    return { ok: true, valor: negativo ? -valor : valor };
}

/** Para mostrar mientras se escribe: el valor interpretado, o null si todavía no es válido. */
export function importeOnull(entrada: unknown, opciones?: OpcionesImporte): number | null {
    const r = parsearImporte(entrada, opciones);
    return r.ok ? r.valor : null;
}

/**
 * Campo zod de importe: acepta texto con formato argentino o un número, y
 * devuelve un number validado. Reemplaza a z.coerce.number() en todos los
 * schemas con importes — z.coerce hace Number("100.000") y eso da 100.
 */
export function zImporte({ mensaje = 'El monto debe ser mayor a 0', ...opciones }: OpcionesImporte & { mensaje?: string } = {}) {
    return z
        .union([z.string(), z.number()], { error: 'Ingresá un importe' })
        .transform((valor, ctx) => {
            const r = parsearImporte(valor, opciones);
            if (!r.ok) {
                ctx.addIssue({ code: 'custom', message: r.error });
                return z.NEVER;
            }
            return r.valor;
        })
        .pipe(z.number().positive(mensaje));
}

/** Igual que zImporte, pero vacío = undefined (campo opcional). */
export function zImporteOpcional(opciones: OpcionesImporte & { mensaje?: string } = {}) {
    return z.preprocess((v) => (v === '' || v === null ? undefined : v), zImporte(opciones).optional());
}
