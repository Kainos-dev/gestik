// src/app/(dashboard)/dashboard/page.tsx
import { CargoFacturadoMes, getCargosFacturadoMes, getCargosProyectadosMes } from '@/features/dashboard/queries';
import { KpiDetalleCard } from '@/features/dashboard/components/kpi-detalle-card';
import { DetalleFacturado } from '@/features/dashboard/components/kpi-detalle-listas';
import {
    getCajaDeAhorro,
    getDisponibleEnCuenta,
    getMovimientosAhorro,
    getMovimientosCuenta,
    getMesesPendientesDeReparto,
    getRepartosMensuales,
} from '@/features/balance-mensual/queries';
import { BalanceMensualPanel, SaldosCuentaYAhorro } from '@/features/balance-mensual/components/balance-mensual-panel';
import { TipoCambioMensualGate } from '@/features/balance-mensual/components/tipo-cambio-mensual-gate';
import { actualizarCotizacionesBlue } from '@/lib/cotizacion-dolar';
import { formatCurrency } from '@/lib/moneda';

// "Octubre 2026", etc. — los títulos de las tarjetas nombran el mes en vez
// de decir "este mes", para no depender de que quien lo mira sepa en qué
// fecha está parado el sistema. En UTC, igual que los meses que se le pasan
// a getCargosFacturadoMes (ver dateToSqlDateString).
function nombreMes(mes: Date): string {
    const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(mes);
    return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} ${mes.getUTCFullYear()}`;
}

// Todo en pesos: los cargos en USD ya vienen convertidos con el blue compra
// (contribucionMesArs, ver getCargosFacturadoMes). Si alguno no tiene
// cotización (la API nunca respondió) no se puede sumar: se avisa en la tarjeta.
function totalEnPesos(cargos: CargoFacturadoMes[]): { total: number; faltaCotizacion: boolean } {
    let total = 0;
    let faltaCotizacion = false;
    for (const c of cargos) {
        if (c.contribucionMesArs === null) faltaCotizacion = true;
        else total += c.contribucionMesArs;
    }
    return { total, faltaCotizacion };
}

function valorEnPesos(cargos: CargoFacturadoMes[]): string {
    const { total, faltaCotizacion } = totalEnPesos(cargos);
    return faltaCotizacion ? `${formatCurrency(total, 'ARS')} + USD sin cotización` : formatCurrency(total, 'ARS');
}

const ACLARACION_USD =
    ' Lo cobrado en dólares se pasa a pesos con el dólar blue compra del día en que se pagó; si todavía no se pagó, con el de hoy (estimado).';

export default async function DashboardPage() {
    const hoy = new Date();
    const mesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesAnterior = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
    const mesSiguiente = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));

    // Antes de calcular nada en pesos, completa el histórico del blue hasta
    // hoy (como mucho una vez cada 10 minutos; si la API falla sigue con lo
    // que ya hay guardado).
    await actualizarCotizacionesBlue();

    const [
        cargosMesActual,
        cargosMesAnterior,
        cargosMesSiguiente,
        cargosProyectadosMesSiguiente,
        mesesPendientesDeReparto,
        repartos,
        disponibleEnCuenta,
        cajaDeAhorro,
        movimientosCuenta,
        movimientosAhorro,
    ] = await Promise.all([
        getCargosFacturadoMes(mesActual),
        getCargosFacturadoMes(mesAnterior),
        getCargosFacturadoMes(mesSiguiente),
        getCargosProyectadosMes(mesSiguiente),
        getMesesPendientesDeReparto(),
        getRepartosMensuales(),
        getDisponibleEnCuenta(),
        getCajaDeAhorro(),
        getMovimientosCuenta(),
        getMovimientosAhorro(),
    ]);

    // "Va a ingresar" = cargos que ya existen y vencen el mes que viene, más
    // los de clientes ANTICIPADO que todavía no se generaron (ver
    // getCargosProyectadosMes).
    const cargosVanAIngresar = [...cargosMesSiguiente, ...cargosProyectadosMesSiguiente];

    // Sólo bloquean los meses con USD que no se pudieron pasar a pesos por
    // falta de cotización (el resto se genera solo vía cron).
    const mesesQueNecesitanTipoCambio = mesesPendientesDeReparto.filter((m) => m.usdSinCotizacion > 0);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Balance Mensual</h1>

            <TipoCambioMensualGate mesesPendientes={mesesQueNecesitanTipoCambio} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiDetalleCard
                    label={`Dinero que ingresó en ${nombreMes(mesAnterior)}`}
                    value={valorEnPesos(cargosMesAnterior)}
                    descripcion={
                        'Cargos que vencían el mes pasado, cada uno completo aunque se haya pagado antes. Es la base del reparto de sueldo, gastos y ahorro.' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosMesAnterior} />
                </KpiDetalleCard>
                <KpiDetalleCard
                    label={`Dinero que ingresa en ${nombreMes(mesActual)}`}
                    value={valorEnPesos(cargosMesActual)}
                    descripcion={
                        'Cargos que vencen este mes, cada uno completo aunque se haya pagado antes.' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosMesActual} />
                </KpiDetalleCard>
                <KpiDetalleCard
                    label={`Dinero que va a ingresar en ${nombreMes(mesSiguiente)}`}
                    value={valorEnPesos(cargosVanAIngresar)}
                    descripcion={
                        'Cargos que vencen el mes que viene, cada uno completo aunque se haya pagado antes. Incluye los de clientes con pago anticipado que todavía no se generaron (se generan el día que vencen).' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosVanAIngresar} />
                </KpiDetalleCard>
            </div>

            <BalanceMensualPanel repartos={repartos} />

            <SaldosCuentaYAhorro
                disponible={disponibleEnCuenta}
                cajaDeAhorro={cajaDeAhorro}
                repartos={repartos}
                movimientosCuenta={movimientosCuenta}
                movimientosAhorro={movimientosAhorro}
            />
        </div>
    );
}
