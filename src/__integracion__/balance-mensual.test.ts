// Prueba de integración de Balance Mensual contra la base LOCAL de pruebas.
// Se saltea salvo que se indique la base, que tiene que ser localhost:
//   GESTIK_DB_PRUEBAS=postgresql://gestik:local@localhost:54329/gestik_dev npm test
// Usa las funciones reales de Gestik y deja la base como estaba al terminar.
import { afterAll, describe, expect, it, vi } from 'vitest';

const URL_PRUEBAS = process.env.GESTIK_DB_PRUEBAS;
if (URL_PRUEBAS && new URL(URL_PRUEBAS).hostname !== 'localhost') {
    throw new Error('GESTIK_DB_PRUEBAS tiene que apuntar a localhost: esta prueba escribe en la base');
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!URL_PRUEBAS)('Balance Mensual contra la base local', async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { pool } = await import('@/lib/db');
    const { crearPago, anularPago } = await import('@/features/pagos/actions');
    const { getCargosFacturadoMes, getCargosProyectadosMes } = await import('@/features/dashboard/queries');
    const { getDisponibleEnCuenta, getRepartosMensuales, getPorcentajesSueldo, getMesesPendientesDeReparto } =
        await import('@/features/balance-mensual/queries');
    const { programarPorcentajeSueldos, renovarRepartosMensuales } = await import('@/features/balance-mensual/actions');
    const { porcentajeVigente } = await import('@/features/balance-mensual/services');
    const { getGastosFijos } = await import('@/features/gastos/queries');
    const { calcularGastosFijosDelMes } = await import('@/features/gastos/services');
    const { getCotizacionBlueVentaHoy } = await import('@/lib/cotizacion-dolar');

    const NOV = new Date(Date.UTC(2026, 10, 1));
    const DIC = new Date(Date.UTC(2026, 11, 1));
    const ENE = new Date(Date.UTC(2027, 0, 1));
    const CARGO_DARC_DIC = '643bb305-708c-4c5e-96c4-33c43a2c10ee';

    // Lo que muestra cada tarjeta mensual: cargos que vencen ese mes + proyectados.
    const tarjeta = async (mes: Date) => {
        const cargos = [...(await getCargosFacturadoMes(mes)), ...(await getCargosProyectadosMes(mes))];
        return {
            total: cargos.reduce((s, c) => s + (c.moneda === 'ARS' ? c.contribucionMes : 0), 0),
            ids: cargos.map((c) => `${c.id}:${c.contribucionMes}`).sort(),
        };
    };
    const cuenta = async () => (await getDisponibleEnCuenta())!.total;
    const anotaciones: string[] = [];
    afterAll(async () => {
        console.log('\n' + anotaciones.join('\n'));
        await pool.end();
    });

    describe('1. Proyección independiente de los cobros', () => {
        it('un cobro adelantado, uno parcial y uno tardío no cambian ninguna tarjeta, pero sí la caja', async () => {
            const s = (
                await pool.query(
                    `SELECT s.id, s.cliente_id, s.precio FROM servicios s
           WHERE s.estado = 'ACTIVO' AND s.moneda = 'ARS' AND s.frecuencia = 'MENSUAL' ORDER BY s.precio DESC LIMIT 1`
                )
            ).rows[0];
            const antes = { nov: await tarjeta(NOV), dic: await tarjeta(DIC), ene: await tarjeta(ENE), cuenta: await cuenta() };

            const ids: string[] = [];
            for (const [monto, fecha] of [
                [String(s.precio), new Date()], // adelantado: paga hoy lo que vence más adelante
                ['1.000', new Date()], // parcial
                ['5.000', new Date('2027-01-20T15:00:00Z')], // tardío (fecha futura, fuera del rango de la caja de hoy)
            ] as const) {
                const r = await crearPago({
                    clienteId: s.cliente_id, servicioId: s.id, fecha, montoPagado: monto,
                    monedaPago: 'ARS', metodoPago: 'TRANSFERENCIA', notas: 'PRUEBA INTEGRACION',
                });
                expect(r.ok).toBe(true);
                ids.push((await pool.query(`SELECT id FROM pagos ORDER BY created_at DESC LIMIT 1`)).rows[0].id);
            }

            expect(await tarjeta(NOV)).toEqual(antes.nov);
            expect(await tarjeta(DIC)).toEqual(antes.dic);
            expect(await tarjeta(ENE)).toEqual(antes.ene);
            expect(await cuenta()).toBe(antes.cuenta + Number(s.precio) + 1000 + 5000);
            anotaciones.push(
                `Proyección: nov $${antes.nov.total} | dic $${antes.dic.total} | ene $${antes.ene.total} — iguales con 3 cobros extra; caja +$${Number(s.precio) + 6000}`
            );

            for (const id of ids) expect((await anularPago(id, 'Limpieza de la prueba')).ok).toBe(true);
            expect(await cuenta()).toBe(antes.cuenta);
        });

        it('un cargo en USD se pasa a pesos con el blue de su vencimiento: terminar de cobrarlo no lo mueve', async () => {
            const OCT = new Date(Date.UTC(2026, 9, 1));
            const enPesos = async (mes: Date) =>
                (await getCargosFacturadoMes(mes)).reduce((s, c) => s + (c.contribucionMesArs ?? 0), 0);
            const reparto = (await getRepartosMensuales()).find((x) => new Date(x.mes).toISOString().startsWith('2026-10'))!;
            const antes = await enPesos(OCT);
            // Octubre ya venció entero: la tarjeta coincide con el reparto que se congeló el 1/11.
            expect(antes).toBeCloseTo(reparto.facturadoArs + reparto.facturadoUsdEnArs, 2);

            const usd = (await pool.query(`SELECT id, cliente_id FROM servicios WHERE moneda = 'USD' AND estado = 'ACTIVO' LIMIT 1`)).rows[0];
            const r = await crearPago({
                clienteId: usd.cliente_id, servicioId: usd.id, fecha: new Date(), montoPagado: '400.000',
                monedaPago: 'ARS', metodoPago: 'TRANSFERENCIA', notas: 'PRUEBA INTEGRACION',
            });
            expect(r.ok).toBe(true);
            const id = (await pool.query(`SELECT id FROM pagos ORDER BY created_at DESC LIMIT 1`)).rows[0].id;
            expect(await enPesos(OCT)).toBeCloseTo(antes, 2); // el cobro tardío no cambia lo proyectado
            await anularPago(id, 'Limpieza de la prueba');
            anotaciones.push(`USD: octubre en pesos $${antes.toFixed(2)} = reparto congelado; igual después de cobrar el saldo de Lu & Mateo`);
        });

        it('un vencimiento del día 1 sigue en su mes aunque la sesión esté en hora argentina', async () => {
            const gmt = await tarjeta(DIC);
            const client = await pool.connect();
            try {
                // Fuerza la zona horaria de TODAS las conexiones del pool a la de Argentina.
                pool.on('connect', (c) => c.query(`SET TIME ZONE 'America/Argentina/Buenos_Aires'`));
                await client.query(`SET TIME ZONE 'America/Argentina/Buenos_Aires'`);
            } finally {
                client.release();
            }
            const art = await tarjeta(DIC);
            expect(art.ids.some((x) => x.startsWith(CARGO_DARC_DIC))).toBe(true);
            expect(art).toEqual(gmt);
            expect((await tarjeta(NOV)).ids.some((x) => x.startsWith(CARGO_DARC_DIC))).toBe(false);
            expect(await getMesesPendientesDeReparto()).toEqual([]); // octubre no se “reabre” por la zona horaria
            pool.removeAllListeners('connect');
            const c2 = await pool.connect();
            await c2.query(`SET TIME ZONE 'GMT'`);
            c2.release();
            anotaciones.push('Zona horaria: con la sesión en hora argentina, el cargo del 01/12 sigue en diciembre');
        });
    });

    describe('2. Porcentaje de sueldos con vigencia', () => {
        it('rechaza un mes cerrado, acepta uno futuro y no toca los repartos existentes', async () => {
            const repartosAntes = await getRepartosMensuales();
            expect((await programarPorcentajeSueldos({ porcentaje: '25', vigenteDesde: new Date('2026-10-15T00:00:00Z') })).ok).toBe(false);
            const r = await programarPorcentajeSueldos({ porcentaje: '25', vigenteDesde: new Date('2027-01-20T00:00:00Z') });
            expect(r).toEqual({ ok: true, vigenteDesde: '2027-01-01' });

            const historial = await getPorcentajesSueldo();
            expect(porcentajeVigente(historial, DIC)).toBe(30);
            expect(porcentajeVigente(historial, ENE)).toBe(25);
            expect(await getRepartosMensuales()).toEqual(repartosAntes);
            anotaciones.push('Porcentaje: 25% programado desde 01/2027; diciembre sigue en 30%; repartos cerrados intactos');

            await pool.query(`DELETE FROM porcentajes_sueldo WHERE vigente_desde = '2027-01-01'`);
        });

        it('el reparto de un mes se genera con el porcentaje vigente de ESE mes y lo guarda', async () => {
            // Simula que octubre todavía no estaba cerrado y que desde octubre rige un 25%.
            const original = (await pool.query(`SELECT * FROM repartos_mensuales WHERE mes = '2026-10-01'`)).rows[0];
            await pool.query(`DELETE FROM repartos_mensuales WHERE mes = '2026-10-01'`);
            await pool.query(`INSERT INTO porcentajes_sueldo (porcentaje, vigente_desde) VALUES (25, '2026-10-01')`);
            try {
                await renovarRepartosMensuales();
                const oct = (await getRepartosMensuales()).find((x) => new Date(x.mes).toISOString().startsWith('2026-10'))!;
                const total = oct.facturadoArs + oct.facturadoUsdEnArs;
                expect(oct.porcentajeSueldos).toBe(25);
                expect(oct.sueldosArs).toBeCloseTo(total * 0.25, 2);
                expect(oct.gastosDeudasArs).toBeCloseTo(total * 0.3, 2);
                expect(oct.ahorroMesArs).toBeCloseTo(total * 0.45, 2);
                const sep = (await getRepartosMensuales()).find((x) => new Date(x.mes).toISOString().startsWith('2026-09'))!;
                expect(sep.porcentajeSueldos).toBe(30); // el mes anterior no se toca
                anotaciones.push(`Reparto: octubre regenerado con 25% → sueldos $${oct.sueldosArs.toFixed(2)} de $${total.toFixed(2)}; septiembre sigue en 30%`);
            } finally {
                // Deja octubre exactamente como estaba.
                await pool.query(`DELETE FROM repartos_mensuales WHERE mes = '2026-10-01'`);
                await pool.query(`DELETE FROM porcentajes_sueldo WHERE vigente_desde = '2026-10-01'`);
                const cols = Object.keys(original);
                await pool.query(
                    `INSERT INTO repartos_mensuales (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
                    cols.map((k) => original[k])
                );
            }
        });
    });

    describe('3. Gastos fijos en USD', () => {
        it('se suman convertidos al blue venta, se actualizan al editarlos y no mueven la caja', async () => {
            const cotizacion = await getCotizacionBlueVentaHoy();
            expect(cotizacion).not.toBeNull();
            const venta = cotizacion!.venta;
            const total = async () => calcularGastosFijosDelMes(await getGastosFijos(), NOV, venta);
            const antes = await total();
            const cuentaAntes = await cuenta();

            const { rows } = await pool.query(
                `INSERT INTO gastos_fijos (nombre, categoria, monto, moneda, frecuencia, fecha_inicio, proximo_vencimiento, estado)
         VALUES ('PRUEBA USD', 'SOFTWARE', 20, 'USD', 'MENSUAL', '2026-11-01', '2026-12-01', 'ACTIVO') RETURNING id`
            );
            try {
                expect((await total()).totalMensualArs).toBeCloseTo(antes.totalMensualArs + 20 * venta, 2);
                await pool.query(`UPDATE gastos_fijos SET monto = 25 WHERE id = $1`, [rows[0].id]);
                expect((await total()).totalMensualArs).toBeCloseTo(antes.totalMensualArs + 25 * venta, 2);
                await pool.query(`UPDATE gastos_fijos SET moneda = 'ARS', monto = 40000 WHERE id = $1`, [rows[0].id]);
                expect((await total()).totalMensualArs).toBeCloseTo(antes.totalMensualArs + 40000, 2);
                expect(await cuenta()).toBe(cuentaAntes); // recalcular el equivalente no crea movimientos
                anotaciones.push(
                    `Gastos fijos: base $${antes.totalMensualArs} → +US$20 a $${venta} = $${(antes.totalMensualArs + 20 * venta).toFixed(2)}; caja sin cambios`
                );
            } finally {
                await pool.query(`DELETE FROM gastos_fijos WHERE id = $1`, [rows[0].id]);
            }
        });
    });
});
