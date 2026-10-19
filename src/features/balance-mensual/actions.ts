// src/features/balance-mensual/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { TipoCambioMensualSchema, TipoCambioMensualInput } from './schema';
import { calcularReparto } from './services';
import { getFacturadoDelMes, getMesesPendientesDeReparto } from './queries';
import { dateToSqlDateString } from '@/lib/utils';
import { actualizarCotizacionesBlue } from '@/lib/cotizacion-dolar';

// Genera el reparto de un mes puntual: recalcula su Facturado (congelándolo
// en la fila) con los USD ya pasados a pesos (blue compra, ver
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
    const reparto = calcularReparto(facturado.ars + usdEnArs);

    await pool.query(
        `INSERT INTO repartos_mensuales
       (mes, facturado_ars, facturado_usd, facturado_usd_en_ars, tipo_cambio,
        sueldos_ars, sueldos_usd, gastos_deudas_ars, gastos_deudas_usd, ahorro_mes_ars)
     VALUES (date_trunc('month', $1::date), $2, $3, $4, $5, $6, 0, $7, 0, $8)
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
