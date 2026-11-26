import { describe, expect, it } from 'vitest';
import {
    evaluarCotizacion,
    necesitaActualizar,
    parsearRespuestaCripto,
    FilaCotizacionCripto,
    VIGENCIA_MS,
    MAX_ANTIGUEDAD_FUENTE_MS,
} from './cotizacion-cripto';

// Respuesta real de https://dolarapi.com/v1/dolares/cripto (26/11/2026).
const REAL = {
    moneda: 'USD',
    casa: 'cripto',
    nombre: 'Cripto',
    compra: 1756.12,
    venta: 1762.96,
    fechaActualizacion: '2026-11-26T11:59:00.000Z',
};

describe('parsearRespuestaCripto', () => {
    it('toma compra, venta y fecha de la respuesta de DolarAPI', () => {
        expect(parsearRespuestaCripto(REAL)).toEqual({
            compra: 1756.12,
            venta: 1762.96,
            actualizadaAt: new Date('2026-11-26T11:59:00.000Z'),
        });
    });

    it('venta es el precio de comprar dólares entregando pesos (el más alto de los dos, cerca de ARQ $1.761,88)', () => {
        const r = parsearRespuestaCripto(REAL)!;
        expect(r.venta).toBeGreaterThan(r.compra);
        expect(Math.abs(r.venta - 1761.88)).toBeLessThan(5);
    });

    it('rechaza respuestas inválidas en vez de inventar un valor', () => {
        expect(parsearRespuestaCripto(null)).toBeNull();
        expect(parsearRespuestaCripto('error')).toBeNull();
        expect(parsearRespuestaCripto({ ...REAL, venta: 0 })).toBeNull();
        expect(parsearRespuestaCripto({ ...REAL, venta: 'abc' })).toBeNull();
        expect(parsearRespuestaCripto({ ...REAL, compra: -1 })).toBeNull();
        expect(parsearRespuestaCripto({ ...REAL, fechaActualizacion: 'no es fecha' })).toBeNull();
        expect(parsearRespuestaCripto({ ...REAL, casa: 'blue' })).toBeNull(); // nunca confundir con otra cotización
        expect(parsearRespuestaCripto({ ...REAL, casa: 'tarjeta' })).toBeNull();
    });
});

describe('vigencia y estados', () => {
    const ahora = new Date('2026-11-26T15:00:00Z');
    const fila = (minutosDesdeConsulta: number, horasDesdePublicacion = 0): FilaCotizacionCripto => ({
        venta: 1762.96,
        obtenidaAt: new Date(ahora.getTime() - minutosDesdeConsulta * 60_000),
        actualizadaAt: new Date(ahora.getTime() - horasDesdePublicacion * 3_600_000),
    });

    it('reutiliza lo guardado durante 30 minutos y después vuelve a consultar', () => {
        expect(VIGENCIA_MS).toBe(30 * 60_000);
        expect(necesitaActualizar(fila(5), ahora)).toBe(false);
        expect(necesitaActualizar(fila(29), ahora)).toBe(false);
        expect(necesitaActualizar(fila(31), ahora)).toBe(true);
        expect(necesitaActualizar(null, ahora)).toBe(true);
    });

    it('un valor reciente no está desactualizado', () => {
        expect(evaluarCotizacion(fila(5), { ahora, fallo: false })).toEqual({
            venta: 1762.96,
            actualizadaAt: ahora.toISOString(),
            desactualizada: false,
        });
    });

    it('si la API falla y lo guardado venció, se usa igual pero marcado como desactualizado', () => {
        const r = evaluarCotizacion(fila(90), { ahora, fallo: true });
        expect(r!.venta).toBe(1762.96);
        expect(r!.desactualizada).toBe(true);
    });

    it('si la fuente publicó el dato hace más de 24 horas, también está desactualizado', () => {
        expect(MAX_ANTIGUEDAD_FUENTE_MS).toBe(24 * 3_600_000);
        expect(evaluarCotizacion(fila(1, 30), { ahora, fallo: false })!.desactualizada).toBe(true);
        expect(evaluarCotizacion(fila(1, 2), { ahora, fallo: false })!.desactualizada).toBe(false);
    });

    it('sin ningún valor guardado: no disponible (null), nunca 0', () => {
        expect(evaluarCotizacion(null, { ahora, fallo: true })).toBeNull();
    });
});
