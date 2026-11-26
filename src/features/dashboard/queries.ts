// src/features/dashboard/queries.ts
import { pool } from '@/lib/db';
import { Pago, mapPago } from '@/features/pagos/types';
import { SaldoCliente, getSaldoVencidoPorCliente } from '@/features/cargos/queries';
import { CategoriaGasto } from '@/features/gastos/types';
import { getTotalIngresosMes } from '@/features/finanzas/queries';
import { MONEDAS, Moneda } from '@/lib/moneda';
import { dateToSqlDateString } from '@/lib/utils';
import { sqlCotizacionBlueVenta } from '@/lib/cotizacion-dolar';
import { vencimientosProyectadosEnMes } from './proyeccion';

// Cargos cuyo vencimiento cae en un mes: es lo que "ingresa" ese mes en
// Balance Mensual y la base de su reparto. Cada cargo cuenta COMPLETO en el
// mes en que vence, sin importar cuándo se pagó (pedido del equipo): si un
// cliente adelanta el pago, igual cuenta para el mes que corresponde. Antes
// se descontaba lo pagado antes de que arrancara el mes, pero esa plata
// adelantada tampoco se contaba en el mes en que se pagó (ese mes sólo suma
// sus propios vencimientos), así que no aparecía en ningún mes ni se
// repartía. "montoCubierto" (waterfall oldest-period-first, igual que
// getCargos en cargos/queries.ts) es sólo para el badge de Estado del cargo.
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
    contribucionMes: number; // lo que cuenta para el mes: el monto completo del cargo
    // Pesos por dólar con que se pasa este cargo a pesos (1 si es en ARS): el
    // blue venta del DÍA DE SU VENCIMIENTO, sin importar cuándo ni cuánto se
    // pagó — la tarjeta es una proyección de lo programado, así que cobrar
    // antes, tarde o en partes no la mueve. Si el vencimiento todavía no
    // llegó, el blue de hoy como estimado (queda fijo al llegar la fecha).
    // null = no hay cotización guardada (la API nunca respondió).
    tipoCambio: number | null;
    cotizacionEstimada: boolean; // true = vence más adelante: tipoCambio es el blue de hoy
    fechaPago: Date | null; // sólo informativo: día en que se terminó de cubrir el cargo
    contribucionMesArs: number | null; // contribucionMes en pesos; null si falta tipoCambio
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
         SUM(monto) AS total_pagado
       FROM pagos
       WHERE servicio_id IS NOT NULL
       GROUP BY servicio_id
     ),
     -- Pagos de cada servicio acumulados por fecha: el primero cuyo
     -- acumulado alcanza el "acumulado_hasta_este" de un cargo es el que lo
     -- terminó de cubrir (mismo waterfall oldest-first que arriba).
     pagos_acumulados AS (
       SELECT
         servicio_id, fecha, moneda_pago, tipo_cambio,
         SUM(monto) OVER (
           PARTITION BY servicio_id
           ORDER BY fecha, created_at, id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS acumulado
       FROM pagos
       WHERE servicio_id IS NOT NULL
     ),
     acumulado AS (
       SELECT
         c.*,
         SUM(c.monto) OVER (
           PARTITION BY c.servicio_id
           ORDER BY c.periodo, c.created_at, c.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS acumulado_hasta_este,
         COALESCE(pps.total_pagado, 0) AS total_pagado_servicio
       FROM cargos c
       LEFT JOIN pagos_por_servicio pps ON pps.servicio_id = c.servicio_id
     )
     SELECT
       a.id, a.moneda, a.monto, a.vencimiento,
       cl.nombre AS cliente_nombre, cl.color AS cliente_color,
       s.tipo AS servicio_tipo, s.nombre_personalizado AS servicio_nombre_personalizado,
       LEAST(a.monto, GREATEST(0, a.total_pagado_servicio - (a.acumulado_hasta_este - a.monto))) AS monto_cubierto,
       cob.fecha AS fecha_pago,
       -- Blue venta del día del vencimiento (en UTC), o el de hoy si todavía no venció.
       CASE
         WHEN a.moneda = 'ARS' THEN 1
         ELSE ${sqlCotizacionBlueVenta("LEAST(a.vencimiento AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')")}
       END AS tipo_cambio,
       a.vencimiento > now() AS cotizacion_estimada
     FROM acumulado a
     JOIN clientes cl ON cl.id = a.cliente_id
     JOIN servicios s ON s.id = a.servicio_id
     LEFT JOIN LATERAL (
       SELECT pa.fecha, pa.moneda_pago, pa.tipo_cambio
       FROM pagos_acumulados pa
       WHERE pa.servicio_id = a.servicio_id AND pa.acumulado >= a.acumulado_hasta_este
       ORDER BY pa.acumulado
       LIMIT 1
     ) cob ON true
     -- Mes del vencimiento en UTC, no en la zona horaria de la sesión: un cargo
     -- que vence el día 1 a las 00:00 UTC es de ese mes aunque la base esté en
     -- hora argentina (ahí se leería como el día anterior a las 21:00).
     WHERE date_trunc('month', a.vencimiento AT TIME ZONE 'UTC') = date_trunc('month', $1::date)
     ORDER BY cl.nombre`,
        [dateToSqlDateString(mes)]
    );
    return rows.map((r) => {
        const monto = Number(r.monto);
        const contribucionMes = monto;
        const tipoCambio = r.tipo_cambio !== null ? Number(r.tipo_cambio) : null;
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
            contribucionMes,
            tipoCambio,
            cotizacionEstimada: r.cotizacion_estimada,
            fechaPago: r.fecha_pago,
            contribucionMesArs: tipoCambio !== null ? contribucionMes * tipoCambio : null,
            proyectado: false,
        };
    });
}

// Cargos que van a vencer en "mes" pero todavía no se generaron. La
// renovación recién crea el cargo de un período el día que arranca ese
// período (cuando llega "proximo_vencimiento"), así que todos los períodos
// desde proximo_vencimiento en adelante todavía no tienen cargo. Se recorren
// esos períodos con las mismas reglas que usa la renovación
// (calcularProximoVencimiento + calcularVencimientoCargo) y se proyectan los
// que vencen en "mes". Ejemplos: un ANTICIPADO cuyo período arranca el 30/11
// vence ese mismo día; un POSPAGO cuyo período arranca el 15/11 vence el
// 15/12, y ese cargo no existe hasta el 15/11. Se suma a getCargosFacturadoMes
// en las tarjetas del mes actual y del mes que viene.
export async function getCargosProyectadosMes(mes: Date): Promise<CargoFacturadoMes[]> {
    const { rows } = await pool.query(
        `SELECT s.id, s.tipo, s.nombre_personalizado, s.proximo_vencimiento, s.precio, s.moneda,
            s.frecuencia, s.vence_fin_de_mes, c.modalidad_pago,
            c.nombre AS cliente_nombre, c.color AS cliente_color,
            CASE WHEN s.moneda = 'ARS' THEN 1 ELSE ${sqlCotizacionBlueVenta('CURRENT_DATE')} END AS tipo_cambio
     FROM servicios s
     JOIN clientes c ON c.id = s.cliente_id
     WHERE s.estado = 'ACTIVO'
       AND s.frecuencia != 'UNICO'
       AND s.proximo_vencimiento IS NOT NULL
     ORDER BY c.nombre`
    );

    const proyectados: CargoFacturadoMes[] = [];

    for (const r of rows) {
        const monto = Number(r.precio);
        const tipoCambio = r.tipo_cambio !== null ? Number(r.tipo_cambio) : null;
        const vencimientos = vencimientosProyectadosEnMes(
            {
                proximoVencimiento: new Date(r.proximo_vencimiento),
                frecuencia: r.frecuencia,
                venceFinDeMes: r.vence_fin_de_mes,
                modalidadPago: r.modalidad_pago,
            },
            mes
        );
        for (const { indice, vencimiento } of vencimientos) {
            proyectados.push({
                id: `proyectado-${r.id}-${indice}`,
                clienteNombre: r.cliente_nombre,
                clienteColor: r.cliente_color,
                servicioTipo: r.tipo,
                servicioNombrePersonalizado: r.nombre_personalizado,
                vencimiento,
                moneda: r.moneda,
                monto,
                montoCubierto: 0,
                contribucionMes: monto,
                tipoCambio, // todavía no venció: estimado con el blue venta de hoy
                cotizacionEstimada: true,
                fechaPago: null,
                contribucionMesArs: tipoCambio !== null ? monto * tipoCambio : null,
                proyectado: true,
            });
        }
    }

    return proyectados;
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
