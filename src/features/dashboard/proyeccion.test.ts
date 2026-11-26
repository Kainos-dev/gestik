import { describe, expect, it } from 'vitest';
import { vencimientosProyectadosEnMes, ServicioProyectable } from './proyeccion';

const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const mes = (anio: number, m: number) => new Date(Date.UTC(anio, m - 1, 1));
const fechas = (s: ServicioProyectable, m: Date) => vencimientosProyectadosEnMes(s, m).map((v) => v.vencimiento.toISOString().slice(0, 10));

// Darc Cuir: mantenimiento mensual POSPAGO; el cargo del período que arranca
// el 01/12 todavía no existe y vence el 01/01 (pospago = al inicio del período siguiente).
const pospago: ServicioProyectable = {
    proximoVencimiento: utc('2026-12-01'),
    frecuencia: 'MENSUAL',
    venceFinDeMes: false,
    modalidadPago: 'POSPAGO',
};

// Lu & Mateo: ANTICIPADO, último día de cada mes.
const anticipadoFinDeMes: ServicioProyectable = {
    proximoVencimiento: utc('2026-11-30'),
    frecuencia: 'MENSUAL',
    venceFinDeMes: true,
    modalidadPago: 'ANTICIPADO',
};

describe('vencimientosProyectadosEnMes', () => {
    it('pospago: el período que arranca el 01/12 se proyecta en enero, no en diciembre', () => {
        expect(fechas(pospago, mes(2026, 12))).toEqual([]);
        expect(fechas(pospago, mes(2027, 1))).toEqual(['2027-01-01']);
    });

    it('un vencimiento del día 1 a las 00:00 UTC cae en ese mes, nunca en el anterior', () => {
        expect(fechas(pospago, mes(2026, 12))).not.toContain('2027-01-01');
        expect(fechas(pospago, new Date('2027-01-31T23:59:59Z'))).toEqual(['2027-01-01']);
    });

    it('se sigue proyectando un cargo por mes mientras el servicio esté activo', () => {
        for (let m = 1; m <= 12; m++) {
            expect(vencimientosProyectadosEnMes(pospago, mes(2027, m))).toHaveLength(1);
        }
    });

    it('anticipado fin de mes: vence el día que arranca su período (30/11, 31/12, 31/01, 28/02)', () => {
        expect(fechas(anticipadoFinDeMes, mes(2026, 11))).toEqual(['2026-11-30']);
        expect(fechas(anticipadoFinDeMes, mes(2026, 12))).toEqual(['2026-12-31']);
        expect(fechas(anticipadoFinDeMes, mes(2027, 1))).toEqual(['2027-01-31']);
        expect(fechas(anticipadoFinDeMes, mes(2027, 2))).toEqual(['2027-02-28']);
    });

    it('arranca en el primer período SIN cargo: los meses ya generados no se repiten', () => {
        // Si el próximo período sin cargo es el de enero, noviembre y diciembre no se proyectan
        // (sus cargos ya existen y cuentan por su cuenta en getCargosFacturadoMes).
        const yaRenovado = { ...anticipadoFinDeMes, proximoVencimiento: utc('2027-01-31') };
        expect(fechas(yaRenovado, mes(2026, 11))).toEqual([]);
        expect(fechas(yaRenovado, mes(2026, 12))).toEqual([]);
        expect(fechas(yaRenovado, mes(2027, 1))).toEqual(['2027-01-31']);
    });

    it('cobros adelantados, tardíos o parciales no entran en el cálculo: sólo cuentan las fechas programadas', () => {
        // La función ni siquiera recibe pagos: la proyección es la misma pase lo que pase con la cobranza.
        const antes = fechas(pospago, mes(2027, 3));
        const despues = fechas({ ...pospago }, mes(2027, 3));
        expect(despues).toEqual(antes);
    });

    it('un servicio único no se proyecta', () => {
        expect(fechas({ ...pospago, frecuencia: 'UNICO' }, mes(2027, 1))).toEqual([]);
    });

    it('anual: sólo en el mes en que vence', () => {
        const anual: ServicioProyectable = { ...pospago, frecuencia: 'ANUAL', proximoVencimiento: utc('2027-03-01') };
        expect(fechas(anual, mes(2028, 3))).toEqual(['2028-03-01']);
        expect(fechas(anual, mes(2028, 4))).toEqual([]);
    });
});
