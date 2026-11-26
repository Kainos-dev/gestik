import { describe, expect, it } from 'vitest';
import {
    calcularReparto,
    inicioDeMesUtc,
    porcentajeVigente,
    validarCambioPorcentaje,
    PorcentajeSueldo,
} from './services';

const mes = (anio: number, m: number, dia = 1) => new Date(Date.UTC(anio, m - 1, dia));

describe('calcularReparto', () => {
    it('con 30% da exactamente el 30/30/40 de siempre', () => {
        expect(calcularReparto(1_000_000)).toEqual({ sueldosArs: 300_000, gastosDeudasArs: 300_000, ahorroMesArs: 400_000 });
        expect(calcularReparto(1_163_730, 30).sueldosArs).toBeCloseTo(349_119, 6); // reparto real de octubre
    });

    it('con otro porcentaje: gastos queda en 30% y el ahorro es lo que sobra', () => {
        expect(calcularReparto(1_000_000, 25)).toEqual({ sueldosArs: 250_000, gastosDeudasArs: 300_000, ahorroMesArs: 450_000 });
        expect(calcularReparto(1_000_000, 35.5)).toEqual({ sueldosArs: 355_000, gastosDeudasArs: 300_000, ahorroMesArs: 345_000 });
    });

    it('rechaza porcentajes imposibles', () => {
        expect(() => calcularReparto(100, 0)).toThrow();
        expect(() => calcularReparto(100, 71)).toThrow(); // con gastos en 30% el ahorro quedaría negativo
        expect(() => calcularReparto(100, NaN)).toThrow();
    });
});

describe('porcentajeVigente', () => {
    const historial: PorcentajeSueldo[] = [
        { porcentaje: 30, vigenteDesde: mes(2026, 6) },
        { porcentaje: 25, vigenteDesde: mes(2027, 1) }, // cambio con vigencia futura
    ];

    it('antes del cambio futuro sigue el 30%', () => {
        expect(porcentajeVigente(historial, mes(2026, 10))).toBe(30);
        expect(porcentajeVigente(historial, mes(2026, 12, 31))).toBe(30);
    });

    it('desde el mes del cambio rige el nuevo, y sigue rigiendo después', () => {
        expect(porcentajeVigente(historial, mes(2027, 1))).toBe(25);
        expect(porcentajeVigente(historial, mes(2027, 1, 15))).toBe(25);
        expect(porcentajeVigente(historial, mes(2028, 6))).toBe(25);
    });

    it('no depende del orden del historial', () => {
        expect(porcentajeVigente([...historial].reverse(), mes(2027, 3))).toBe(25);
        expect(porcentajeVigente([...historial].reverse(), mes(2026, 11))).toBe(30);
    });

    it('sin historial (o antes del primero) usa el 30% por defecto', () => {
        expect(porcentajeVigente([], mes(2026, 10))).toBe(30);
        expect(porcentajeVigente(historial, mes(2025, 1))).toBe(30);
    });

    it('un vencimiento del día 1 a las 00:00 UTC es de ese mes', () => {
        expect(inicioDeMesUtc(new Date('2027-01-01T00:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
        expect(porcentajeVigente(historial, new Date('2027-01-01T00:00:00Z'))).toBe(25);
    });
});

describe('validarCambioPorcentaje', () => {
    const ultimoCerrado = mes(2026, 10); // octubre ya tiene reparto

    it('acepta un cambio con vigencia futura y lo lleva al día 1', () => {
        const r = validarCambioPorcentaje(25, mes(2027, 1, 20), ultimoCerrado);
        expect(r).toEqual({ ok: true, vigenteDesde: mes(2027, 1) });
    });

    it('acepta el mes siguiente al último cerrado (el mes en curso)', () => {
        expect(validarCambioPorcentaje(28, mes(2026, 11, 5), ultimoCerrado).ok).toBe(true);
    });

    it('rechaza meses que ya tienen el reparto cerrado: no altera períodos anteriores', () => {
        const r = validarCambioPorcentaje(25, mes(2026, 10, 15), ultimoCerrado);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain('11/2026');
        expect(validarCambioPorcentaje(25, mes(2026, 3), ultimoCerrado).ok).toBe(false);
    });

    it('rechaza porcentajes fuera de rango', () => {
        expect(validarCambioPorcentaje(0, mes(2027, 1), ultimoCerrado).ok).toBe(false);
        expect(validarCambioPorcentaje(70.01, mes(2027, 1), ultimoCerrado).ok).toBe(false);
        expect(validarCambioPorcentaje(70, mes(2027, 1), ultimoCerrado).ok).toBe(true);
    });

    it('sin ningún reparto cerrado acepta cualquier mes', () => {
        expect(validarCambioPorcentaje(30, mes(2020, 1), null).ok).toBe(true);
    });
});
