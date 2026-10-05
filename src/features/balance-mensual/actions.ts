// src/features/balance-mensual/actions.ts
'use server';

import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { TipoCambioMensualSchema, TipoCambioMensualInput } from './schema';
import { calcularReparto } from './services';
import { getFacturadoDelMes, getMesesPendientesDeReparto } from './queries';
import { dateToSqlDateString } from '@/lib/utils';

// Genera el reparto de un mes puntual: recalcula su Facturado (congelándolo
// en la fila), aplica el 30/50/20 y lo inserta. "tipoCambio" sólo hace
// falta cuando ese mes tuvo Facturado en USD (calcularReparto tira si
// falta); el ON CONFLICT evita duplicar si dos llamadas pisan el mismo mes
// (ej. el cron y alguien cargando el tipo de cambio a mano casi al mismo
// tiempo).
async function generarReparto(mes: Date, tipoCambio?: number) {
    const { ars, usd } = await getFacturadoDelMes(mes);
    const reparto = calcularReparto(ars, usd, tipoCambio);

    await pool.query(
        `INSERT INTO repartos_mensuales
       (mes, facturado_ars, facturado_usd, tipo_cambio, sueldos_ars, sueldos_usd, gastos_deudas_ars, gastos_deudas_usd, ahorro_mes_ars)
     VALUES (date_trunc('month', $1::date), $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (mes) DO NOTHING`,
        [
            dateToSqlDateString(mes),
            ars,
            usd,
            usd > 0 ? tipoCambio : null,
            reparto.sueldosArs,
            reparto.sueldosUsd,
            reparto.gastosDeudasArs,
            reparto.gastosDeudasUsd,
            reparto.ahorroMesArs,
        ]
    );
}

// Carga manual del tipo de cambio de un mes puntual (PD1 del domain model):
// se usa cuando ese mes tuvo Facturado en USD y por eso quedó pendiente de
// reparto — ver getMesesPendientesDeReparto. Después de generarlo, sigue
// con los meses pendientes que ya tenían USD=0 (se generan solos), por si
// había más de uno en cola.
export async function registrarTipoCambioMensual(data: TipoCambioMensualInput) {
    const parsed = TipoCambioMensualSchema.parse(data);
    await generarReparto(parsed.mes, parsed.tipoCambio);
    await renovarRepartosMensuales();

    revalidatePath('/dashboard');
}

// Se llama desde el cron diario (/api/cron/renovar-repartos-mensuales):
// recorre los meses ya cerrados sin reparto (oldest-first) y genera solo
// los que no tuvieron Facturado en USD. Se detiene apenas encuentra uno que
// sí tuvo (necesita que alguien cargue el tipo de cambio a mano primero,
// ver registrarTipoCambioMensual) — los meses más nuevos quedan pendientes
// hasta que ese se resuelva, porque el ahorro acumulado es una cuenta
// corrida mes a mes, no tiene sentido saltearse uno en el medio.
export async function renovarRepartosMensuales() {
    const pendientes = await getMesesPendientesDeReparto();

    let generados = 0;
    for (const mes of pendientes) {
        if (mes.facturadoUsd > 0) break;
        await generarReparto(mes.mes);
        generados++;
    }

    if (generados > 0) revalidatePath('/dashboard');

    return { generados, pendientesRestantes: pendientes.length - generados };
}
