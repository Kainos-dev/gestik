// src/features/balance-mensual/types.ts
import { Moneda } from '@/lib/moneda';

// Reparto del Facturado de un mes en sueldos (30%) / cuenta de gastos
// fijos y deudas (30%) / ahorro (40%) — ver calcularReparto en services.ts.
// "facturadoArs"/"facturadoUsd" quedan congelados al momento de generarse
// (no se recalculan después). Todo el reparto es en pesos: lo facturado en
// USD se pasa a pesos con el blue compra (facturadoUsdEnArs) antes de
// repartir, así que sueldosUsd/gastosDeudasUsd quedan en 0 (las columnas
// siguen existiendo por los repartos anteriores a la conversión automática).
export interface RepartoMensual {
    id: string;
    mes: Date;
    facturadoArs: number;
    facturadoUsd: number;
    facturadoUsdEnArs: number; // facturadoUsd ya pasado a pesos (blue compra) — 0 en repartos viejos sin USD
    tipoCambio: number | null; // promedio efectivo usado para los USD (facturadoUsdEnArs / facturadoUsd)
    sueldosArs: number;
    sueldosUsd: number;
    gastosDeudasArs: number;
    gastosDeudasUsd: number;
    ahorroMesArs: number;
    createdAt: Date;
}

export function mapRepartoMensual(row: any): RepartoMensual {
    return {
        id: row.id,
        mes: row.mes,
        facturadoArs: Number(row.facturado_ars),
        facturadoUsd: Number(row.facturado_usd),
        facturadoUsdEnArs: Number(row.facturado_usd_en_ars),
        tipoCambio: row.tipo_cambio !== null ? Number(row.tipo_cambio) : null,
        sueldosArs: Number(row.sueldos_ars),
        sueldosUsd: Number(row.sueldos_usd),
        gastosDeudasArs: Number(row.gastos_deudas_ars),
        gastosDeudasUsd: Number(row.gastos_deudas_usd),
        ahorroMesArs: Number(row.ahorro_mes_ars),
        createdAt: row.created_at,
    };
}

// Mes que todavía no tiene reparto generado (ver getMesesPendientesDeReparto
// en queries.ts). Normalmente se genera solo; sólo si usdSinCotizacion > 0
// (USD que no se pudieron pasar a pesos porque no había ninguna cotización
// guardada) hace falta cargar el tipo de cambio a mano.
export interface MesPendienteDeReparto {
    mes: Date;
    facturadoArs: number;
    facturadoUsd: number;
    usdSinCotizacion: number;
}

// Un renglón del historial de "Plata disponible en cuenta" o de "Caja de
// ahorro" (ver getMovimientosCuenta/getMovimientosAhorro en queries.ts).
// "monto" (en pesos) va con signo (+ entra, - sale) y "saldo" es cómo quedó
// la cuenta justo después de este movimiento. Si el movimiento fue en USD,
// "monedaOriginal"/"montoOriginal" dicen cuánto fue en dólares y
// "tipoCambio" con qué blue compra se pasó a pesos; "monto" es null si no
// había cotización guardada para ese día. Los REPARTO no traen nombre: se
// arma en el componente a partir de "mesReparto".
export type TipoMovimientoSaldo = 'REPARTO' | 'GASTO_FIJO' | 'GASTO' | 'REPOSICION_DEUDA';

export interface MovimientoSaldo {
    id: string;
    tipo: TipoMovimientoSaldo;
    fecha: Date;
    nombre: string | null;
    mesReparto: Date | null;
    monedaOriginal: Moneda;
    montoOriginal: number;
    tipoCambio: number | null;
    monto: number | null;
    saldo: number;
}

export function mapMovimientoSaldo(row: any): MovimientoSaldo {
    return {
        id: row.id,
        tipo: row.tipo,
        fecha: row.fecha,
        nombre: row.nombre,
        mesReparto: row.mes_reparto,
        monedaOriginal: row.moneda_original,
        montoOriginal: Number(row.monto_original),
        tipoCambio: row.tipo_cambio !== null ? Number(row.tipo_cambio) : null,
        monto: row.monto !== null ? Number(row.monto) : null,
        saldo: Number(row.saldo),
    };
}
