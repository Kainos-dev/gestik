// src/features/balance-mensual/types.ts
import { Moneda } from '@/lib/moneda';

// Reparto del Facturado de un mes en sueldos (30%) / cuenta de gastos
// fijos y deudas (30%) / ahorro (40%) — ver calcularReparto en services.ts.
// "facturadoArs"/"facturadoUsd" quedan congelados al momento de generarse
// (no se recalculan después). Sueldos y gastosDeudas se guardan separados
// por moneda, sin convertir; sólo "ahorroMesArs" está ya fundido en pesos
// (ver domain model: se guarda en reservas de Mercado Pago).
export interface RepartoMensual {
    id: string;
    mes: Date;
    facturadoArs: number;
    facturadoUsd: number;
    tipoCambio: number | null;
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
// en queries.ts). Si facturadoUsd > 0, hace falta cargar el tipo de cambio
// de ese mes (a mano) antes de poder generarlo — si es 0, se puede generar
// solo, sin pedir nada.
export interface MesPendienteDeReparto {
    mes: Date;
    facturadoArs: number;
    facturadoUsd: number;
}

// Un renglón del historial de "Plata disponible en cuenta" o de "Caja de
// ahorro" (ver getMovimientosCuenta/getMovimientosAhorro en queries.ts).
// "monto" va con signo (+ entra, - sale) y "saldo" es cómo quedó la cuenta
// en esa moneda justo después de este movimiento. Los REPARTO no traen
// nombre: se arma en el componente a partir de "mesReparto".
export type TipoMovimientoSaldo = 'REPARTO' | 'GASTO_FIJO' | 'REPOSICION_DEUDA';

export interface MovimientoSaldo {
    id: string;
    tipo: TipoMovimientoSaldo;
    fecha: Date;
    nombre: string | null;
    mesReparto: Date | null;
    moneda: Moneda;
    monto: number;
    saldo: number;
}

export function mapMovimientoSaldo(row: any): MovimientoSaldo {
    return {
        id: row.id,
        tipo: row.tipo,
        fecha: row.fecha,
        nombre: row.nombre,
        mesReparto: row.mes_reparto,
        moneda: row.moneda,
        monto: Number(row.monto),
        saldo: Number(row.saldo),
    };
}
