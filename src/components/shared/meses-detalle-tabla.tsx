// src/components/shared/meses-detalle-tabla.tsx
import { Moneda, MONEDAS, formatCurrency } from '@/lib/moneda';

const MESES_LARGOS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMesLargo(mes: string): string {
    const [yyyy, mm] = mes.split('-');
    return `${MESES_LARGOS[Number(mm) - 1]} ${yyyy}`;
}

// Tabla de detalle para IngresosChart/GastosChart: ambas series son
// "mes + moneda + total", así que una sola tabla pivot (mes en filas,
// moneda en columnas) sirve para las dos sin repetir el componente. Cada
// celda es la suma de todo lo que entró/se gastó ESE mes en ESA moneda
// (no un acumulado ni una conversión entre monedas) — el encabezado "Total
// ARS"/"Total USD" lo deja explícito en vez de depender de que se entienda
// por contexto.
export function MesesDetalleTabla({ data }: { data: { mes: string; moneda: Moneda; total: number }[] }) {
    const meses = Array.from(new Set(data.map((d) => d.mes))).sort();
    const porMesMoneda = new Map(data.map((d) => [`${d.mes}:${d.moneda}`, d.total]));

    if (meses.length === 0) {
        return <p className="text-sm text-muted-foreground">No hay datos para mostrar.</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Mes</th>
                    {MONEDAS.map((moneda) => (
                        <th key={moneda} className="pb-2 font-medium text-right">
                            Total {moneda}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {meses.map((mes) => (
                    <tr key={mes} className="border-b last:border-0">
                        <td className="py-2">{formatMesLargo(mes)}</td>
                        {MONEDAS.map((moneda) => (
                            <td key={moneda} className="py-2 text-right">
                                {formatCurrency(porMesMoneda.get(`${mes}:${moneda}`) ?? 0, moneda)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
