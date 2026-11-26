// src/features/balance-mensual/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
    TipoCambioMensualSchema,
    TipoCambioMensualInput,
    MovimientoCuentaSchema,
    MovimientoCuentaInput,
    PorcentajeSueldoSchema,
    PorcentajeSueldoInput,
} from './schema';
import { calcularReparto, validarCambioPorcentaje, porcentajeVigente } from './services';
import { getFacturadoDelMes, getMesesPendientesDeReparto, getPorcentajesSueldo } from './queries';
import { dateToSqlDateString } from '@/lib/utils';
import { actualizarCotizacionesBlue } from '@/lib/cotizacion-dolar';

// Genera el reparto de un mes puntual: recalcula su Facturado (congelándolo
// en la fila) con los USD ya pasados a pesos (blue venta, ver
// getFacturadoDelMes), aplica el 30/30/40 y lo inserta. "tipoCambioManual"
// sólo se usa para los USD que no se pudieron convertir por falta de
// cotización guardada; sin él, si falta alguna, tira. El ON CONFLICT evita
// duplicar si dos llamadas pisan el mismo mes (ej. el cron y alguien
// cargando el tipo de cambio a mano casi al mismo tiempo).
async function generarReparto(mes: Date, tipoCambioManual?: number) {
    const facturado = await getFacturadoDelMes(mes);
    if (facturado.usdSinCotizacion > 0 && !tipoCambioManual) {
        throw new Error('Falta la cotización del dólar para repartir el Facturado en USD de este mes');
    }
    const usdEnArs = facturado.usdEnArs + facturado.usdSinCotizacion * (tipoCambioManual ?? 0);
    // El porcentaje de sueldos vigente para ESE mes (no el de hoy), y queda guardado en la fila.
    const porcentajeSueldos = porcentajeVigente(await getPorcentajesSueldo(), mes);
    const reparto = calcularReparto(facturado.ars + usdEnArs, porcentajeSueldos);

    await pool.query(
        `INSERT INTO repartos_mensuales
       (mes, facturado_ars, facturado_usd, facturado_usd_en_ars, tipo_cambio,
        sueldos_ars, sueldos_usd, gastos_deudas_ars, gastos_deudas_usd, ahorro_mes_ars, porcentaje_sueldos)
     VALUES (date_trunc('month', $1::date), $2, $3, $4, $5, $6, 0, $7, 0, $8, $9)
     ON CONFLICT (mes) DO NOTHING`,
        [
            dateToSqlDateString(mes),
            facturado.ars,
            facturado.usd,
            usdEnArs,
            // Promedio efectivo, sólo como dato (cada cargo usó el de su día).
            facturado.usd > 0 ? usdEnArs / facturado.usd : null,
            reparto.sueldosArs,
            reparto.gastosDeudasArs,
            reparto.ahorroMesArs,
            porcentajeSueldos,
        ]
    );
}

// Carga manual del tipo de cambio de un mes puntual: sólo hace falta si
// ese mes tuvo USD que no se pudieron pasar a pesos porque no había ninguna
// cotización del blue guardada (la API no respondió) — ver
// getMesesPendientesDeReparto. Después de generarlo, sigue con los meses
// pendientes que sí se pueden generar solos, por si había más de uno en cola.
export async function registrarTipoCambioMensual(data: TipoCambioMensualInput) {
    const parsed = TipoCambioMensualSchema.parse(data);
    await generarReparto(parsed.mes, parsed.tipoCambio);
    await renovarRepartosMensuales();

    revalidatePath('/dashboard');
}

// Se llama desde el cron diario (/api/cron/renovar-repartos-mensuales):
// primero actualiza las cotizaciones del blue, después recorre los meses
// ya cerrados sin reparto (oldest-first) y los genera. Se detiene apenas
// encuentra uno con USD sin cotización (necesita que alguien cargue el tipo
// de cambio a mano primero, ver registrarTipoCambioMensual) — los meses más nuevos quedan pendientes
// hasta que ese se resuelva, porque el ahorro acumulado es una cuenta
// corrida mes a mes, no tiene sentido saltearse uno en el medio.
export async function renovarRepartosMensuales() {
    await actualizarCotizacionesBlue();
    const pendientes = await getMesesPendientesDeReparto();

    let generados = 0;
    for (const mes of pendientes) {
        if (mes.usdSinCotizacion > 0) break;
        await generarReparto(mes.mes);
        generados++;
    }

    if (generados > 0) revalidatePath('/dashboard');

    return { generados, pendientesRestantes: pendientes.length - generados };
}

// Ingreso o retiro manual de "Plata disponible en cuenta" o de "Caja de
// ahorro": plata que entra o sale por fuera de lo que el sistema ya registra
// (pagos, gastos, reposiciones de deuda). La caja de ahorro se carga sólo así.
export async function registrarMovimientoCuenta(data: MovimientoCuentaInput) {
    const parsed = MovimientoCuentaSchema.parse(data);

    await pool.query(
        `INSERT INTO movimientos_cuenta (tipo, cuenta, fecha, monto, descripcion) VALUES ($1, $2, $3, $4, $5)`,
        [parsed.tipo, parsed.cuenta, parsed.fecha, parsed.monto, parsed.descripcion || null]
    );

    revalidatePath('/dashboard');
}

// ─── Porcentaje de sueldos ──────────────────────────────────────────────────

export type ResultadoPorcentaje = { ok: true; vigenteDesde: string } | { ok: false; error: string };

// Programa el porcentaje de sueldos desde el mes de la fecha elegida. No toca
// ningún reparto ya generado (cada uno guarda su porcentaje) y no acepta un
// mes que ya tenga el reparto cerrado (ver validarCambioPorcentaje). Si ya
// había un cambio programado para ese mismo mes, lo reemplaza; la fila
// anterior queda en el historial con su vigencia.
export async function programarPorcentajeSueldos(data: PorcentajeSueldoInput): Promise<ResultadoPorcentaje> {
    const parsed = PorcentajeSueldoSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

    try {
        const { rows } = await pool.query(`SELECT MAX(mes)::text AS ultimo FROM repartos_mensuales`);
        const ultimoMesCerrado = rows[0]?.ultimo ? new Date(`${rows[0].ultimo}T00:00:00Z`) : null;
        const validacion = validarCambioPorcentaje(parsed.data.porcentaje, parsed.data.vigenteDesde, ultimoMesCerrado);
        if (!validacion.ok) return validacion;

        const desde = dateToSqlDateString(validacion.vigenteDesde);
        await pool.query(
            `INSERT INTO porcentajes_sueldo (porcentaje, vigente_desde)
       VALUES ($1, $2::date)
       ON CONFLICT (vigente_desde) DO UPDATE SET porcentaje = EXCLUDED.porcentaje, updated_at = now()`,
            [parsed.data.porcentaje, desde]
        );
        revalidatePath('/dashboard');
        return { ok: true, vigenteDesde: desde };
    } catch (error) {
        console.error('Error al guardar el porcentaje de sueldos:', error);
        return { ok: false, error: 'No se pudo guardar el porcentaje. Probá de nuevo.' };
    }
}
