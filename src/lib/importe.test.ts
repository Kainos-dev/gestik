import { describe, expect, it } from 'vitest';
import { importeOnull, parsearImporte, zImporte } from './importe';
import { PagoSchema } from '@/features/pagos/schema';
import { DeudaSchema, ReposicionDeudaSchema } from '@/features/deudas/schema';
import { GastoSchema } from '@/features/gastos/schema';
import { ServicioSchema } from '@/features/services/schema';

const valor = (entrada: unknown, decimales?: number) => {
    const r = parsearImporte(entrada, { decimales });
    if (!r.ok) throw new Error(`"${String(entrada)}" se rechazó: ${r.error}`);
    return r.valor;
};
const rechaza = (entrada: unknown, decimales?: number) => parsearImporte(entrada, { decimales }).ok === false;

describe('parsearImporte — tabla pedida', () => {
    it.each([
        ['100000', 100000],
        ['100.000', 100000],
        ['1.000.000', 1000000],
        ['1500,50', 1500.5],
        ['1.500,50', 1500.5],
        ['1500.50', 1500.5],
    ])('%s → %d', (entrada, esperado) => {
        expect(valor(entrada)).toBe(esperado);
    });
});

describe('parsearImporte — otros formatos válidos', () => {
    it.each([
        ['50.000', 50000],
        ['1.500', 1500], // un solo grupo de 3 tras el punto = miles (formato argentino)
        ['2.5', 2.5], // el punto no agrupa de a 3: sólo puede ser decimal
        ['0.5', 0.5],
        ['0,75', 0.75],
        ['12.345.678,9', 12345678.9],
        ['  150.000  ', 150000],
        ['$ 150.000', 150000],
        ['$150.000,50', 150000.5],
        ['US$ 100', 100],
        ['1 500', 1500], // espacios internos se ignoran
        ['-1.500', -1500], // el signo lo valida cada schema (todos exigen > 0)
    ])('%s → %d', (entrada, esperado) => {
        expect(valor(entrada)).toBe(esperado);
    });

    it('acepta un número que ya viene como número', () => {
        expect(valor(150000)).toBe(150000);
        expect(valor(1500.5)).toBe(1500.5);
    });

    it('tipo de cambio con hasta 4 decimales', () => {
        expect(valor('1.234,5678', 4)).toBe(1234.5678);
        expect(valor('1500.1234', 4)).toBe(1500.1234);
    });
});

describe('parsearImporte — entradas ambiguas o mal formadas se rechazan', () => {
    it.each([
        '',
        '   ',
        'abc',
        '1,500.50', // formato inglés: mezcla de separadores
        '1.50.000', // grupos de miles mal armados
        '1.000.00',
        '12.34.5',
        '1,2,3',
        '1,000,000',
        '1500,',
        ',50',
        '.50',
        '1500.',
        '0.500', // "miles" con cero adelante: ¿0,5 o 500?
        '012.345',
        '1e5',
        '0x10',
        'Infinity',
        '150000abc',
        '--5',
    ])('"%s"', (entrada) => {
        expect(rechaza(entrada)).toBe(true);
    });

    it('más decimales de los admitidos no se redondean en silencio', () => {
        expect(rechaza('1500,505')).toBe(true);
        expect(rechaza('1234.567')).toBe(true); // ni miles (4 cifras antes) ni 2 decimales
        expect(rechaza(10.555)).toBe(true);
        expect(rechaza('1.234,56789', 4)).toBe(true);
    });

    it('rechaza lo que no es texto ni número', () => {
        expect(rechaza(null)).toBe(true);
        expect(rechaza(undefined)).toBe(true);
        expect(rechaza(NaN)).toBe(true);
        expect(rechaza({})).toBe(true);
    });

    it('importeOnull devuelve null en vez de inventar un número', () => {
        expect(importeOnull('1,500.50')).toBeNull();
        expect(importeOnull('')).toBeNull();
        expect(importeOnull('100.000')).toBe(100000);
    });
});

describe('precisión', () => {
    it('no introduce errores de punto flotante al normalizar', () => {
        expect(valor('0,1') + valor('0,2')).toBeCloseTo(0.3, 10);
        expect(valor('1.234.567,89')).toBe(1234567.89);
        expect(valor('99.999.999,99')).toBe(99999999.99);
    });
});

describe('zImporte en los schemas reales', () => {
    it('exige mayor a 0', () => {
        expect(zImporte().safeParse('0').success).toBe(false);
        expect(zImporte().safeParse('-1.500').success).toBe(false);
        expect(zImporte().safeParse('1.500').data).toBe(1500);
    });

    it('cobro: "100.000" se guarda como 100000, no como 100', () => {
        const r = PagoSchema.parse({
            clienteId: 'c',
            fecha: new Date('2026-11-25'),
            montoPagado: '100.000',
            monedaPago: 'ARS',
            metodoPago: 'TRANSFERENCIA',
        });
        expect(r.montoPagado).toBe(100000);
        expect(r.tipoCambio).toBeUndefined();
    });

    it('cobro: tipo de cambio manual con formato argentino; vacío = sin tipo de cambio', () => {
        const base = { clienteId: 'c', fecha: new Date(), montoPagado: '100', monedaPago: 'USD', metodoPago: 'EFECTIVO' } as const;
        expect(PagoSchema.parse({ ...base, tipoCambio: '1.512,50' }).tipoCambio).toBe(1512.5);
        expect(PagoSchema.parse({ ...base, tipoCambio: '' }).tipoCambio).toBeUndefined();
        expect(PagoSchema.safeParse({ ...base, tipoCambio: '1,512.50' }).success).toBe(false);
    });

    it('cobro: un importe ambiguo no pasa la validación', () => {
        const r = PagoSchema.safeParse({
            clienteId: 'c',
            fecha: new Date(),
            montoPagado: '1,500.50',
            monedaPago: 'ARS',
            metodoPago: 'TRANSFERENCIA',
        });
        expect(r.success).toBe(false);
    });

    it('deudas, reposiciones, gastos y servicios usan el mismo parser', () => {
        expect(DeudaSchema.shape.montoTotal.parse('1.000.000')).toBe(1000000);
        expect(ReposicionDeudaSchema.shape.montoPagado.parse('1.500,50')).toBe(1500.5);
        expect(GastoSchema.shape.monto.parse('150.000')).toBe(150000);
        expect(ServicioSchema.shape.precio.parse('50.000')).toBe(50000);
    });
});
