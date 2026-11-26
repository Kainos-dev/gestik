import { describe, expect, it } from 'vitest';
import { calcularGastosFijosDelMes, equivalenteEnPesos } from './services';
import { GastoFijo } from './types';

const noviembre = new Date(Date.UTC(2026, 10, 1));
let n = 0;
const gasto = (p: Partial<GastoFijo>): GastoFijo => ({
    id: `g${++n}`,
    nombre: 'Gasto',
    categoria: 'SOFTWARE',
    monto: 1000,
    moneda: 'ARS',
    frecuencia: 'MENSUAL',
    fechaInicio: new Date('2026-08-01T00:00:00Z'),
    proximoVencimiento: new Date('2026-12-01T00:00:00Z'),
    estado: 'ACTIVO',
    notas: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
});

describe('equivalenteEnPesos', () => {
    it('ARS queda igual; USD × blue venta', () => {
        expect(equivalenteEnPesos(34727, 'ARS', null)).toBe(34727);
        expect(equivalenteEnPesos(20, 'USD', 1725)).toBe(34500);
        expect(equivalenteEnPesos(9.99, 'USD', 1725)).toBe(17232.75);
    });

    it('sin cotización (o inválida) devuelve null, nunca 0 ni un valor inventado', () => {
        expect(equivalenteEnPesos(20, 'USD', null)).toBeNull();
        expect(equivalenteEnPesos(20, 'USD', 0)).toBeNull();
        expect(equivalenteEnPesos(20, 'USD', NaN)).toBeNull();
    });
});

describe('calcularGastosFijosDelMes', () => {
    const fijos = [
        gasto({ nombre: 'Adobe', monto: 34727 }),
        gasto({ nombre: 'Claude', monto: 20, moneda: 'USD', frecuencia: 'MENSUAL_30_DIAS' }),
        gasto({ nombre: 'Dominio', monto: 15, moneda: 'USD', frecuencia: 'ANUAL' }),
        gasto({ nombre: 'Pausado', monto: 5000, estado: 'PAUSADO' }),
        gasto({ nombre: 'Finalizado', monto: 5000, estado: 'FINALIZADO' }),
        gasto({ nombre: 'Arranca en enero', monto: 7000, fechaInicio: new Date('2027-01-10T00:00:00Z') }),
    ];

    it('suma ARS y USD convertidos con el blue venta, sólo de los activos que ya empezaron', () => {
        const r = calcularGastosFijosDelMes(fijos, noviembre, 1725);
        expect(r.mensuales.map((g) => g.gastoFijo.nombre)).toEqual(['Adobe', 'Claude']);
        expect(r.totalMensualArs).toBe(34727 + 20 * 1725);
        expect(r.usdSinConvertir).toBe(0);
        expect(r.porMoneda).toEqual([
            { moneda: 'ARS', total: 34727 },
            { moneda: 'USD', total: 20 },
        ]);
    });

    it('los anuales se listan aparte y no suman al total mensual', () => {
        const r = calcularGastosFijosDelMes(fijos, noviembre, 1725);
        expect(r.anuales.map((g) => g.gastoFijo.nombre)).toEqual(['Dominio']);
        expect(r.anuales[0].montoArs).toBe(15 * 1725);
    });

    it('si cambia la cotización cambia el equivalente en pesos, pero no el monto original en USD', () => {
        const a = calcularGastosFijosDelMes(fijos, noviembre, 1725);
        const b = calcularGastosFijosDelMes(fijos, noviembre, 1800);
        expect(b.totalMensualArs - a.totalMensualArs).toBe(20 * (1800 - 1725));
        expect(b.porMoneda).toEqual(a.porMoneda);
        expect(fijos.find((g) => g.nombre === 'Claude')!.monto).toBe(20);
    });

    it('si se edita el importe o la moneda de un gasto fijo, el total se recalcula', () => {
        const editados = fijos.map((g) => (g.nombre === 'Claude' ? { ...g, monto: 25 } : g));
        expect(calcularGastosFijosDelMes(editados, noviembre, 1725).totalMensualArs).toBe(34727 + 25 * 1725);
        const aPesos = fijos.map((g) => (g.nombre === 'Claude' ? { ...g, moneda: 'ARS' as const, monto: 40000 } : g));
        expect(calcularGastosFijosDelMes(aPesos, noviembre, 1725).totalMensualArs).toBe(34727 + 40000);
    });

    it('sin cotización no convierte con 0: deja afuera los USD y avisa cuánto falta', () => {
        const r = calcularGastosFijosDelMes(fijos, noviembre, null);
        expect(r.totalMensualArs).toBe(34727);
        expect(r.usdSinConvertir).toBe(20);
        expect(r.mensuales.find((g) => g.gastoFijo.nombre === 'Claude')!.montoArs).toBeNull();
    });

    it('un gasto que empieza en enero recién cuenta en enero', () => {
        const enero = new Date(Date.UTC(2027, 0, 1));
        expect(calcularGastosFijosDelMes(fijos, enero, 1725).mensuales.map((g) => g.gastoFijo.nombre)).toContain('Arranca en enero');
    });
});
