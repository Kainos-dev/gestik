// Pruebas de anulación/restauración de cobros, sin base de datos real: una
// base falsa en memoria responde a las consultas exactas que hacen
// anularPago y restaurarPago, con las mismas garantías que Postgres (fila
// bloqueada, índice único de anulación vigente, transacción que se revierte).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluarRestauracion, ContextoRestauracion, CobroArchivado } from './services';

// ─── Base falsa ─────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;
interface Estado {
    pagos: Map<string, Fila>;
    clientes: Set<string>;
    servicios: Map<string, { cliente_id: string; moneda: string }>;
    anulados: Map<string, { id: string; tabla: string; registro_id: string; datos: Fila; motivo: string; restaurado_at: Date | null }>;
}

const db: Estado = { pagos: new Map(), clientes: new Set(), servicios: new Map(), anulados: new Map() };
let secuencia = 0;
const consultas: string[] = [];

function errorUnico() {
    return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
}

function crearCliente() {
    // Copia de trabajo por transacción: se aplica sólo con COMMIT.
    let tx: Estado | null = null;
    const actual = () => tx ?? db;
    const clonar = (e: Estado): Estado => ({
        pagos: new Map([...e.pagos].map(([k, v]) => [k, { ...v }])),
        clientes: new Set(e.clientes),
        servicios: new Map(e.servicios),
        anulados: new Map([...e.anulados].map(([k, v]) => [k, { ...v }])),
    });

    async function query(sql: string, params: unknown[] = []) {
        const s = sql.replace(/\s+/g, ' ').trim();
        consultas.push(s.split(' ').slice(0, 4).join(' '));
        const e = actual();

        if (s === 'BEGIN') { tx = clonar(db); return { rows: [], rowCount: 0 }; }
        if (s === 'COMMIT') { Object.assign(db, tx); tx = null; return { rows: [], rowCount: 0 }; }
        if (s === 'ROLLBACK') { tx = null; return { rows: [], rowCount: 0 }; }

        if (s.startsWith('SELECT cliente_id FROM pagos WHERE id = $1 FOR UPDATE')) {
            const p = e.pagos.get(params[0] as string);
            return { rows: p ? [{ cliente_id: p.cliente_id }] : [], rowCount: p ? 1 : 0 };
        }
        if (s.startsWith('INSERT INTO registros_anulados')) {
            const [id, motivo] = params as [string, string];
            const p = e.pagos.get(id);
            if (!p) return { rows: [], rowCount: 0 };
            const vigente = [...e.anulados.values()].some((a) => a.tabla === 'pagos' && a.registro_id === id && !a.restaurado_at);
            if (vigente) throw errorUnico();
            const rid = `ra-${++secuencia}`;
            e.anulados.set(rid, { id: rid, tabla: 'pagos', registro_id: id, datos: { ...p }, motivo, restaurado_at: null });
            return { rows: [], rowCount: 1 };
        }
        if (s.startsWith('DELETE FROM pagos WHERE id = $1')) {
            const ok = e.pagos.delete(params[0] as string);
            return { rows: [], rowCount: ok ? 1 : 0 };
        }
        if (s.startsWith('SELECT registro_id, restaurado_at')) {
            const a = e.anulados.get(params[0] as string);
            if (!a) return { rows: [], rowCount: 0 };
            const d = a.datos;
            return {
                rows: [{
                    registro_id: a.registro_id, restaurado_at: a.restaurado_at,
                    cliente_id: d.cliente_id, servicio_id: d.servicio_id ?? null, moneda: d.moneda,
                    moneda_pago: d.moneda_pago, monto_pagado: String(d.monto_pagado), fecha: (d.fecha as Date).toISOString(),
                }],
                rowCount: 1,
            };
        }
        if (s.startsWith('SELECT EXISTS (SELECT 1 FROM pagos WHERE id = $1) AS cobro_ya_activo')) {
            const [id, clienteId, servicioId, fecha, monedaPago, montoPagado] = params as string[];
            const servicio = servicioId ? e.servicios.get(servicioId) : undefined;
            const igual = [...e.pagos.values()].some(
                (p) => p.cliente_id === clienteId && (p.servicio_id ?? null) === (servicioId ?? null) &&
                    (p.fecha as Date).toISOString() === fecha && p.moneda_pago === monedaPago && Number(p.monto_pagado) === Number(montoPagado)
            );
            return {
                rows: [{
                    cobro_ya_activo: e.pagos.has(id), cliente_existe: e.clientes.has(clienteId),
                    servicio_moneda: servicio?.moneda ?? null, servicio_cliente_id: servicio?.cliente_id ?? null,
                    hay_cobro_igual_activo: igual,
                }],
                rowCount: 1,
            };
        }
        if (s.startsWith('INSERT INTO pagos SELECT * FROM jsonb_populate_record')) {
            const a = e.anulados.get(params[0] as string)!;
            if (e.pagos.has(a.registro_id)) throw errorUnico();
            e.pagos.set(a.registro_id, { ...a.datos, updated_at: new Date() });
            return { rows: [], rowCount: 1 };
        }
        if (s.startsWith('UPDATE registros_anulados SET restaurado_at = now()')) {
            e.anulados.get(params[0] as string)!.restaurado_at = new Date();
            return { rows: [], rowCount: 1 };
        }
        throw new Error(`Consulta no prevista en la base falsa: ${s.slice(0, 80)}`);
    }
    return { query, release: () => { tx = null; } };
}

vi.mock('@/lib/db', () => ({
    pool: {
        connect: async () => crearCliente(),
        query: async () => { throw new Error('anular/restaurar no deberían usar pool.query fuera de la transacción'); },
    },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { anularPago, restaurarPago } = await import('./actions');

// ─── Datos de prueba ────────────────────────────────────────────────────────

function sembrar() {
    db.pagos.clear(); db.clientes.clear(); db.servicios.clear(); db.anulados.clear(); consultas.length = 0;
    db.clientes.add('darc');
    db.servicios.set('mantenimiento', { cliente_id: 'darc', moneda: 'ARS' });
    db.servicios.set('web-usd', { cliente_id: 'darc', moneda: 'USD' });
    db.pagos.set('p-real', {
        id: 'p-real', cliente_id: 'darc', servicio_id: 'mantenimiento', fecha: new Date('2026-11-05T13:44:45Z'),
        monto: '40000.00', moneda: 'ARS', moneda_pago: 'ARS', monto_pagado: '40000.00', tipo_cambio: null,
    });
    db.pagos.set('p-prueba', {
        id: 'p-prueba', cliente_id: 'darc', servicio_id: 'mantenimiento', fecha: new Date('2026-11-25T16:59:43Z'),
        monto: '50000.00', moneda: 'ARS', moneda_pago: 'ARS', monto_pagado: '50000.00', tipo_cambio: null,
    });
    db.pagos.set('p-usd', {
        id: 'p-usd', cliente_id: 'darc', servicio_id: 'web-usd', fecha: new Date('2026-11-12T12:00:00Z'),
        monto: '100.00', moneda: 'USD', moneda_pago: 'ARS', monto_pagado: '156500.00', tipo_cambio: '1565.00',
    });
}

// Lo que "ven" la caja, Balance Mensual y Gestión: la suma de lo que entró (monto_pagado) de los pagos vigentes.
const totalCaja = () => [...db.pagos.values()].reduce((s, p) => s + Number(p.monto_pagado), 0);
const totalServicio = (id: string) =>
    [...db.pagos.values()].filter((p) => p.servicio_id === id).reduce((s, p) => s + Number(p.monto), 0);
const ultimoAnulado = () => [...db.anulados.values()].at(-1)!;

beforeEach(sembrar);

// ─── Acciones ───────────────────────────────────────────────────────────────

describe('anularPago', () => {
    it('saca el cobro de pagos y lo archiva completo, con motivo', async () => {
        const antes = totalCaja();
        expect(await anularPago('p-prueba', 'Cobro de prueba')).toEqual({ ok: true });
        expect(db.pagos.has('p-prueba')).toBe(false);
        expect(totalCaja()).toBe(antes - 50000);
        expect(totalServicio('mantenimiento')).toBe(40000);
        const a = ultimoAnulado();
        expect(a.registro_id).toBe('p-prueba');
        expect(a.motivo).toBe('Cobro de prueba');
        expect(a.datos.monto_pagado).toBe('50000.00');
    });

    it('no anula dos veces: la segunda vez responde error y no descuenta de nuevo', async () => {
        await anularPago('p-prueba', 'Cobro de prueba');
        const despues = totalCaja();
        const r = await anularPago('p-prueba', 'Otra vez');
        expect(r).toEqual({ ok: false, error: 'Ese cobro ya fue anulado o no existe' });
        expect(totalCaja()).toBe(despues);
        expect(db.anulados.size).toBe(1);
    });

    it('exige motivo y no toca la base si falta', async () => {
        expect((await anularPago('p-prueba', '  ')).ok).toBe(false);
        expect((await anularPago('p-prueba', 'no')).ok).toBe(false);
        expect(db.pagos.has('p-prueba')).toBe(true);
        expect(consultas).toHaveLength(0);
    });

    it('si falla a mitad de camino no queda nada a medias', async () => {
        db.anulados.set('ra-x', { id: 'ra-x', tabla: 'pagos', registro_id: 'p-prueba', datos: {}, motivo: 'x', restaurado_at: null });
        const r = await anularPago('p-prueba', 'Cobro de prueba');
        expect(r).toEqual({ ok: false, error: 'Ese cobro ya fue anulado' });
        expect(db.pagos.has('p-prueba')).toBe(true); // ROLLBACK: sigue vigente
        expect(db.anulados.size).toBe(1);
    });
});

describe('restaurarPago', () => {
    it('vuelve a insertar el cobro idéntico y los totales quedan como antes', async () => {
        const original = { ...db.pagos.get('p-prueba')! };
        const antes = totalCaja();
        await anularPago('p-prueba', 'Cobro de prueba');
        expect(await restaurarPago(ultimoAnulado().id)).toEqual({ ok: true });
        const restaurado = db.pagos.get('p-prueba')!;
        expect({ ...restaurado, updated_at: undefined }).toEqual({ ...original, updated_at: undefined });
        expect(totalCaja()).toBe(antes);
        expect(ultimoAnulado().restaurado_at).not.toBeNull();
    });

    it('conserva la conversión y la cotización histórica de un cobro en USD', async () => {
        await anularPago('p-usd', 'Prueba');
        await restaurarPago(ultimoAnulado().id);
        const p = db.pagos.get('p-usd')!;
        expect(p.monto).toBe('100.00');
        expect(p.moneda).toBe('USD');
        expect(p.monto_pagado).toBe('156500.00');
        expect(p.tipo_cambio).toBe('1565.00');
    });

    it('no restaura dos veces (no suma dos veces)', async () => {
        await anularPago('p-prueba', 'Cobro de prueba');
        const rid = ultimoAnulado().id;
        await restaurarPago(rid);
        const despues = totalCaja();
        expect(await restaurarPago(rid)).toEqual({ ok: false, error: 'Ese cobro ya está restaurado' });
        expect(totalCaja()).toBe(despues);
    });

    it('se niega si mientras tanto se volvió a cargar un cobro igual', async () => {
        const copia = { ...db.pagos.get('p-prueba')! };
        await anularPago('p-prueba', 'Cargado mal');
        db.pagos.set('p-nuevo', { ...copia, id: 'p-nuevo' });
        const r = await restaurarPago(ultimoAnulado().id);
        expect(r.ok).toBe(false);
        expect(db.pagos.has('p-prueba')).toBe(false);
    });

    it('se niega si el servicio cambió de moneda', async () => {
        await anularPago('p-prueba', 'Cargado mal');
        db.servicios.set('mantenimiento', { cliente_id: 'darc', moneda: 'USD' });
        const r = await restaurarPago(ultimoAnulado().id);
        expect(r.ok).toBe(false);
        expect(db.pagos.has('p-prueba')).toBe(false);
    });

    it('anular → restaurar → anular de nuevo funciona (cada anulación es un registro nuevo)', async () => {
        await anularPago('p-prueba', 'Primera');
        await restaurarPago(ultimoAnulado().id);
        expect(await anularPago('p-prueba', 'Segunda')).toEqual({ ok: true });
        expect(db.anulados.size).toBe(2);
        expect(db.pagos.has('p-prueba')).toBe(false);
    });
});

// ─── Regla pura ─────────────────────────────────────────────────────────────

describe('evaluarRestauracion', () => {
    const cobro: CobroArchivado = { clienteId: 'darc', servicioId: 'mantenimiento', moneda: 'ARS' };
    const ok: ContextoRestauracion = {
        yaRestaurado: false,
        cobroYaActivo: false,
        clienteExiste: true,
        servicio: { clienteId: 'darc', moneda: 'ARS' },
        hayCobroIgualActivo: false,
    };

    it('permite restaurar cuando todo coincide', () => expect(evaluarRestauracion(cobro, ok)).toEqual({ ok: true }));
    it.each<[string, Partial<ContextoRestauracion>]>([
        ['ya restaurado', { yaRestaurado: true }],
        ['ya activo', { cobroYaActivo: true }],
        ['cliente borrado', { clienteExiste: false }],
        ['servicio borrado', { servicio: null }],
        ['servicio de otro cliente', { servicio: { clienteId: 'otro', moneda: 'ARS' } }],
        ['servicio en otra moneda', { servicio: { clienteId: 'darc', moneda: 'USD' } }],
        ['cobro igual ya activo', { hayCobroIgualActivo: true }],
    ])('rechaza: %s', (_, cambio) => {
        expect(evaluarRestauracion(cobro, { ...ok, ...cambio }).ok).toBe(false);
    });
    it('un cobro sin servicio no depende del servicio', () => {
        expect(evaluarRestauracion({ ...cobro, servicioId: null }, { ...ok, servicio: null })).toEqual({ ok: true });
    });
});
