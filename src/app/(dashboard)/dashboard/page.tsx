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
    getPorcentajesSueldo,
} from '@/features/balance-mensual/queries';
import { getGastosFijos } from '@/features/gastos/queries';
import { calcularGastosFijosDelMes } from '@/features/gastos/services';
import { BalanceMensualPanel, SaldosCuentaYAhorro } from '@/features/balance-mensual/components/balance-mensual-panel';
import { TipoCambioMensualGate } from '@/features/balance-mensual/components/tipo-cambio-mensual-gate';
import { actualizarCotizacionesBlue } from '@/lib/cotizacion-dolar';
import { obtenerCotizacionCripto } from '@/lib/cotizacion-cripto';
import { formatCurrency } from '@/lib/moneda';

// "Octubre 2026", etc. — los títulos de las tarjetas nombran el mes en vez
// de decir "este mes", para no depender de que quien lo mira sepa en qué
// fecha está parado el sistema. En UTC, igual que los meses que se le pasan
// a getCargosFacturadoMes (ver dateToSqlDateString).
function nombreMes(mes: Date): string {
    const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(mes);
    return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} ${mes.getUTCFullYear()}`;
}

// Todo en pesos: los cargos en USD ya vienen convertidos con el blue venta
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
    ' Lo que se factura en dólares se pasa a pesos con el dólar blue venta del día del vencimiento (si todavía no venció, con el de hoy, estimado). Cobrar antes, tarde o en partes no cambia estos montos: eso se ve en la cuenta.';

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
        cargosProyectadosMesActual,
        cargosProyectadosMesSiguiente,
        mesesPendientesDeReparto,
        repartos,
        disponibleEnCuenta,
        cajaDeAhorro,
        movimientosCuenta,
        movimientosAhorro,
        porcentajesSueldo,
        gastosFijos,
        cotizacionArq,
    ] = await Promise.all([
        getCargosFacturadoMes(mesActual),
        getCargosFacturadoMes(mesAnterior),
        getCargosFacturadoMes(mesSiguiente),
        getCargosProyectadosMes(mesActual),
        getCargosProyectadosMes(mesSiguiente),
        getMesesPendientesDeReparto(),
        getRepartosMensuales(),
        getDisponibleEnCuenta(),
        getCajaDeAhorro(),
        getMovimientosCuenta(),
        getMovimientosAhorro(),
        getPorcentajesSueldo(),
        getGastosFijos(),
        obtenerCotizacionCripto(), // estimación del costo de ARQ para los gastos fijos en USD
    ]);

    // "Ingresa" / "Va a ingresar" = cargos que ya existen y vencen ese mes,
    // más los que todavía no se generaron porque su período no arrancó (ver
    // getCargosProyectadosMes).
    const cargosIngresan = [...cargosMesActual, ...cargosProyectadosMesActual];
    const cargosVanAIngresar = [...cargosMesSiguiente, ...cargosProyectadosMesSiguiente];

    // Sólo bloquean los meses con USD que no se pudieron pasar a pesos por
    // falta de cotización (el resto se genera solo vía cron).
    const mesesQueNecesitanTipoCambio = mesesPendientesDeReparto.filter((m) => m.usdSinCotizacion > 0);

    return (
        // En escritorio (lg+) la página ocupa exactamente el alto del <main>:
        // las tres filas de tarjetas se reparten el alto disponible (1 : 1 : 2,2; la
        // de saldos crece más porque usa el espacio para sus últimos movimientos)
        // en vez de quedar agrupadas arriba. Cada fila nunca baja de lo que mide
        // su contenido (flex-basis 0 + min-height auto), así que en una ventana
        // muy baja nada se corta: el <main> del layout vuelve a scrollear, igual
        // que en mobile, donde todo queda apilado con su alto natural.
        <div className="flex flex-col gap-3 lg:h-full">
            <h1 className="shrink-0 text-xl font-semibold">Balance Mensual</h1>

            <TipoCambioMensualGate mesesPendientes={mesesQueNecesitanTipoCambio} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:flex-[1_1_0%]">
                <KpiDetalleCard
                    label={`Dinero que Ingresó en ${nombreMes(mesAnterior)}`}
                    value={valorEnPesos(cargosMesAnterior)}
                    descripcion={
                        'Cargos que vencían el mes pasado, cada uno completo aunque se haya pagado antes. Es la base del reparto de sueldo, gastos y ahorro.' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosMesAnterior} />
                </KpiDetalleCard>
                <KpiDetalleCard
                    label={`Dinero que Ingresa en ${nombreMes(mesActual)}`}
                    value={valorEnPesos(cargosIngresan)}
                    descripcion={
                        'Cargos que vencen este mes, cada uno completo aunque se haya pagado antes. Incluye los que todavía no se generaron porque su período no arrancó.' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosIngresan} />
                </KpiDetalleCard>
                <KpiDetalleCard
                    label={`Dinero que Va a Ingresar en ${nombreMes(mesSiguiente)}`}
                    value={valorEnPesos(cargosVanAIngresar)}
                    descripcion={
                        'Cargos que vencen el mes que viene, cada uno completo aunque se haya pagado antes. Incluye los que todavía no se generaron porque su período no arrancó.' +
                        ACLARACION_USD
                    }
                >
                    <DetalleFacturado cargos={cargosVanAIngresar} />
                </KpiDetalleCard>
            </div>

            <BalanceMensualPanel
                repartos={repartos}
                porcentajesSueldo={porcentajesSueldo}
                gastosFijosDelMes={calcularGastosFijosDelMes(gastosFijos, mesActual, cotizacionArq?.venta ?? null)}
                cotizacion={cotizacionArq}
            />

            <SaldosCuentaYAhorro
                disponible={disponibleEnCuenta}
                cajaDeAhorro={cajaDeAhorro}
                movimientosCuenta={movimientosCuenta}
                movimientosAhorro={movimientosAhorro}
            />
        </div>
    );
}
