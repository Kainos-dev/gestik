// src/features/dashboard/queries.ts
import { pool } from '@/lib/db';
import { Pago, mapPago } from '@/features/pagos/types';
import { SaldoCliente, getSaldoVencidoPorCliente } from '@/features/cargos/queries';
import { CategoriaGasto } from '@/features/gastos/types';
import { getTotalIngresosMes } from '@/features/finanzas/queries';
import { MONEDAS, Moneda } from '@/lib/moneda';
import { dateToSqlDateString } from '@/lib/utils';

// Cargos cuyo vencimiento cae este mes, con cuánto de cada uno ya estaba
// cubierto ANTES de que arrancara el mes (mismo waterfall oldest-period-
// first de getCargos en cargos/queries.ts, pero el total pagado del
// servicio se corta en pagos con fecha anterior al 1º del mes actual). Un
// cargo que ya se cobró de más antes de que empezara el mes no "debería
// entrar" de nuevo este mes — esa plata ya entró el mes pasado — así que
// "contribucionMes" (monto - lo ya cubierto antes del mes) es lo que
// realmente cuenta para "Dinero que debería entrar este mes", no el monto
// completo del cargo. "montoCubierto" (sin el corte de fecha) se mantiene
// aparte sólo para calcular el badge de Estado real del cargo.
export interface CargoFacturadoMes {
    id: string;
    clienteNombre: string;
    clienteColor: string;
    servicioTipo: string;
    servicioNombrePersonalizado: string | null;
    vencimiento: Date;
    moneda: Moneda;
    monto: number;
    montoCubierto: number;
    montoCubiertoAntesDelMes: number;
    contribucionMes: number;
    // true = el cargo todavía no existe, se proyecta a partir del servicio
    // (ver getCargosProyectadosMes) — no tiene id real ni estado de pago.
    proyectado: boolean;
}

// "mes" es cualquier fecha dentro del mes que se quiere consultar (por
// defecto, hoy — o sea el mes actual). Parametrizable para poder recalcular
// el Facturado de un mes YA CERRADO (ver balance-mensual/queries.ts,
// getFacturadoDelMes) sin duplicar este query completo.
export async function getCargosFacturadoMes(mes: Date = new Date()): Promise<CargoFacturadoMes[]> {
    const { rows } = await pool.query(
        `WITH pagos_por_servicio AS (
       SELECT
         servicio_id,
         SUM(monto) AS total_pagado,
         SUM(monto) FILTER (WHERE fecha < date_trunc('month', $1::date)) AS total_pagado_antes_del_mes
       FROM pagos
       WHERE servicio_id IS NOT NULL
       GROUP BY servicio_id
     ),
     acumulado AS (
       SELECT
         c.*,
         SUM(c.monto) OVER (
           PARTITION BY c.servicio_id
           ORDER BY c.periodo, c.created_at, c.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS acumulado_hasta_este,
         COALESCE(pps.total_pagado, 0) AS total_pagado_servicio,
         COALESCE(pps.total_pagado_antes_del_mes, 0) AS total_pagado_antes_del_mes
       FROM cargos c
       LEFT JOIN pagos_por_servicio pps ON pps.servicio_id = c.servicio_id
     )
     SELECT
       a.id, a.moneda, a.monto, a.vencimiento,
       cl.nombre AS cliente_nombre, cl.color AS cliente_color,
       s.tipo AS servicio_tipo, s.nombre_personalizado AS servicio_nombre_personalizado,
       LEAST(a.monto, GREATEST(0, a.total_pagado_servicio - (a.acumulado_hasta_este - a.monto))) AS monto_cubierto,
       LEAST(a.monto, GREATEST(0, a.total_pagado_antes_del_mes - (a.acumulado_hasta_este - a.monto))) AS monto_cubierto_antes_del_mes
     FROM acumulado a
     JOIN clientes cl ON cl.id = a.cliente_id
     JOIN servicios s ON s.id = a.servicio_id
     WHERE date_trunc('month', a.vencimiento) = date_trunc('month', $1::date)
     ORDER BY cl.nombre`,
        [dateToSqlDateString(mes)]
    );
    return rows.map((r) => {
        const monto = Number(r.monto);
        const montoCubiertoAntesDelMes = Number(r.monto_cubierto_antes_del_mes);
        return {
            id: r.id,
            clienteNombre: r.cliente_nombre,
            clienteColor: r.cliente_color,
            servicioTipo: r.servicio_tipo,
            servicioNombrePersonalizado: r.servicio_nombre_personalizado,
            vencimiento: r.vencimiento,
            moneda: r.moneda,
            monto,
            montoCubierto: Number(r.monto_cubierto),
            montoCubiertoAntesDelMes,
            contribucionMes: monto - montoCubiertoAntesDelMes,
            proyectado: false,
        };
    });
}

// Cargos que van a vencer en "mes" pero todavía no se generaron. Sólo pasa
// con clientes ANTICIPADO: su cargo vence al arrancar su propio periodo
// (ver calcularVencimientoCargo en services/services.ts), y ese cargo recién
// lo crea la renovación el mismo día que llega "proximo_vencimiento". Los
// POSPAGO no hace falta proyectarlos — su cargo que vence el mes que viene
// ya existe (se generó al arrancar el periodo actual). Se usa para "Dinero
// que va a ingresar" el mes siguiente, sumado a getCargosFacturadoMes.
export async function getCargosProyectadosMes(mes: Date): Promise<CargoFacturadoMes[]> {
    const { rows } = await pool.query(
        `SELECT s.id, s.tipo, s.nombre_personalizado, s.proximo_vencimiento, s.precio, s.moneda,
            c.nombre AS cliente_nombre, c.color AS cliente_color
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     WHERE s.estado = 'ACTIVO'
       AND s.frecuencia != 'UNICO'
       AND c.modalidad_pago = 'ANTICIPADO'
       AND date_trunc('month', s.proximo_vencimiento) = date_trunc('month', $1::date)
     ORDER BY c.nombre`,
        [dateToSqlDateString(mes)]
    );
    return rows.map((r) => {
        const monto = Number(r.precio);
        return {
            id: `proyectado-${r.id}`,
            clienteNombre: r.cliente_nombre,
            clienteColor: r.cliente_color,
            servicioTipo: r.tipo,
            servicioNombrePersonalizado: r.nombre_personalizado,
            vencimiento: r.proximo_vencimiento,
            moneda: r.moneda,
            monto,
            montoCubierto: 0,
            montoCubiertoAntesDelMes: 0,
            contribucionMes: monto,
            proyectado: true,
        };
    });
}

export interface KpiPorMoneda {
    moneda: Moneda;
    totalFacturadoMes: number;
    totalCobradoMes: number;
    totalVencido: number;
}

export interface DashboardKpis {
    porMoneda: KpiPorMoneda[];
    clientesActivos: number;
}

// Facturado/cobrado/pendiente no se pueden sumar entre ARS y USD, así que
// cada KPI queda desglosado por moneda en vez de un único número.
export async function getKpis(): Promise<DashboardKpis> {
    const [cargosFacturadoMes, cobrado, clientes, saldos] = await Promise.all([
        // "Facturado del mes" = suma de "contribucionMes" de los cargos cuyo
        // VENCIMIENTO (fecha de finalización del ciclo) cae en el mes actual
        // — ver comentario completo en getCargosFacturadoMes. No es el monto
        // completo del cargo: lo que ya se había cobrado antes de que
        // arrancara el mes se descuenta, porque esa plata ya entró el mes
        // pasado, no "debería entrar" de nuevo este mes.
        getCargosFacturadoMes(),
        // "Cobrado del mes" acá es exactamente "Ingresos del mes" en Gestión
        // (gestión/page.tsx) — mismo número, dos nombres según el contexto de
        // cada pantalla. Se reusa getTotalIngresosMes (finanzas/queries.ts)
        // en vez de repetir la query acá, para que no puedan desincronizarse.
        getTotalIngresosMes(),
        pool.query(`SELECT COUNT(*) AS total FROM clientes WHERE estado = 'ACTIVO'`),
        // Sólo cargos ya VENCIDOS (vencimiento pasó y no se cubrieron del
        // todo) — no "todo lo que el cliente debe en total" (eso incluiría
        // cargos futuros que todavía ni vencen, como el ciclo del mes que
        // viene de un servicio ya renovado).
        getSaldoVencidoPorCliente(),
    ]);

    const facturadoPorMoneda = new Map<Moneda, number>();
    for (const c of cargosFacturadoMes) {
        facturadoPorMoneda.set(c.moneda, (facturadoPorMoneda.get(c.moneda) ?? 0) + c.contribucionMes);
    }
    const cobradoPorMoneda = new Map(cobrado.map((r) => [r.moneda, r.total]));
    const vencidoPorMoneda = new Map<Moneda, number>();
    for (const s of saldos) {
        vencidoPorMoneda.set(s.moneda, (vencidoPorMoneda.get(s.moneda) ?? 0) + s.saldo);
    }

    return {
        porMoneda: MONEDAS.map((moneda) => ({
            moneda,
            totalFacturadoMes: facturadoPorMoneda.get(moneda) ?? 0,
            totalCobradoMes: cobradoPorMoneda.get(moneda) ?? 0,
            totalVencido: vencidoPorMoneda.get(moneda) ?? 0,
        })),
        clientesActivos: Number(clientes.rows[0].total),
    };
}

export interface ProximoVencimiento {
    id: string;
    clienteNombre: string;
    clienteColor: string;
    tipo: string;
    nombrePersonalizado: string | null;
    proximoVencimiento: Date;
    precio: number;
    moneda: Moneda;
}

export async function getProximosVencimientos(): Promise<ProximoVencimiento[]> {
    const { rows } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo, s.nombre_personalizado, s.proximo_vencimiento, s.precio, s.moneda
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     WHERE s.estado = 'ACTIVO'
       AND s.proximo_vencimiento IS NOT NULL
       AND s.proximo_vencimiento <= CURRENT_DATE + INTERVAL '15 days'
     ORDER BY s.proximo_vencimiento ASC
     LIMIT 8`
    );
    return rows.map((r) => ({
        id: r.id,
        clienteNombre: r.cliente_nombre,
        clienteColor: r.cliente_color,
        tipo: r.tipo,
        nombrePersonalizado: r.nombre_personalizado,
        proximoVencimiento: r.proximo_vencimiento,
        precio: Number(r.precio),
        moneda: r.moneda,
    }));
}

// Mismo criterio que getProximosVencimientos, pero del lado de nuestros
// gastos fijos (Adobe, hosting, etc.) en vez de los planes de los clientes
// — las dos mitades de "Próximos vencimientos" en el dashboard.
export interface ProximoVencimientoGasto {
    id: string;
    nombre: string;
    categoria: CategoriaGasto;
    proximoVencimiento: Date;
    monto: number;
    moneda: Moneda;
}

export async function getProximosVencimientosGastos(): Promise<ProximoVencimientoGasto[]> {
    const { rows } = await pool.query(
        `SELECT id, nombre, categoria, proximo_vencimiento, monto, moneda
     FROM gastos_fijos
     WHERE estado = 'ACTIVO'
       AND proximo_vencimiento IS NOT NULL
       AND proximo_vencimiento <= CURRENT_DATE + INTERVAL '15 days'
     ORDER BY proximo_vencimiento ASC
     LIMIT 8`
    );
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        categoria: r.categoria,
        proximoVencimiento: r.proximo_vencimiento,
        monto: Number(r.monto),
        moneda: r.moneda,
    }));
}

// "Últimos movimientos" del dashboard: antes sólo mostraba pagos de
// clientes (ingresos); ahora es el panorama completo del negocio, mezclando
// ingresos (pagos) y egresos (gastos) en una sola línea de tiempo ordenada
// por fecha, con "tipo" como discriminante para que el componente sepa
// cómo pintar cada fila.
export type Movimiento =
    | {
          id: string;
          tipo: 'INGRESO';
          fecha: Date;
          clienteNombre: string;
          clienteColor: string;
          monto: number;
          moneda: Moneda;
      }
    | {
          id: string;
          tipo: 'EGRESO';
          fecha: Date;
          descripcion: string;
          categoria: CategoriaGasto;
          monto: number;
          moneda: Moneda;
      };

export async function getUltimosMovimientos(): Promise<Movimiento[]> {
    const [pagos, gastos] = await Promise.all([
        pool.query(
            `SELECT p.id, p.fecha, p.monto, p.moneda, c.nombre AS cliente_nombre, c.color AS cliente_color
       FROM pagos p
       JOIN clientes c ON c.id = p.cliente_id
       ORDER BY p.created_at DESC
       LIMIT 10`
        ),
        pool.query(
            `SELECT id, fecha, monto, moneda, descripcion, categoria
       FROM gastos
       ORDER BY created_at DESC
       LIMIT 10`
        ),
    ]);

    const ingresos: Movimiento[] = pagos.rows.map((r) => ({
        id: r.id,
        tipo: 'INGRESO' as const,
        fecha: r.fecha,
        clienteNombre: r.cliente_nombre,
        clienteColor: r.cliente_color,
        monto: Number(r.monto),
        moneda: r.moneda,
    }));

    const egresos: Movimiento[] = gastos.rows.map((r) => ({
        id: r.id,
        tipo: 'EGRESO' as const,
        fecha: r.fecha,
        descripcion: r.descripcion,
        categoria: r.categoria,
        monto: Number(r.monto),
        moneda: r.moneda,
    }));

    return [...ingresos, ...egresos]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 10);
}

// Detalle que compone cada KPI del mes, para mostrarlo al abrir la tarjeta.
// Mismos criterios que getKpis: cargos cuyo vencimiento cae este mes (ver
// getCargosFacturadoMes), pagos por mes de "fecha", vencido por saldo
// VENCIDO de cliente y moneda (ver getSaldoVencidoPorCliente).
export interface DetalleKpis {
    cargosMes: CargoFacturadoMes[];
    pagosMes: Pago[];
    saldosVencidos: SaldoCliente[];
}

export async function getDetalleKpis(): Promise<DetalleKpis> {
    const [cargosFacturadoMes, pagos, saldos] = await Promise.all([
        getCargosFacturadoMes(),
        pool.query(
            `SELECT p.*, c.nombre AS cliente_nombre, c.color AS cliente_color, s.tipo AS servicio_nombre
       FROM pagos p
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN servicios s ON s.id = p.servicio_id
       WHERE date_trunc('month', p.fecha) = date_trunc('month', CURRENT_DATE)
       ORDER BY p.fecha DESC, p.created_at DESC`
        ),
        getSaldoVencidoPorCliente(),
    ]);

    return {
        cargosMes: cargosFacturadoMes,
        pagosMes: pagos.rows.map(mapPago),
        saldosVencidos: saldos.sort((a, b) => b.saldo - a.saldo),
    };
}
