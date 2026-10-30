// src/features/gastos/components/gastos-fijos-total.tsx
import { GastoFijo } from '../types';
import { calcularTotalesGastosFijosActivos } from '../services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/moneda';

// Cuadrado arriba de los botones de gastos fijos: cuánto suman todos los
// gastos fijos activos. Una línea por moneda (nunca se suman ARS y USD), y
// los anuales en una línea secundaria para no inflar el total mensual.
export function GastosFijosTotal({ gastosFijos }: { gastosFijos: GastoFijo[] }) {
    const { mensual, anual } = calcularTotalesGastosFijosActivos(gastosFijos);
    const mensualConMonto = mensual.filter((t) => t.total > 0);
    const anualConMonto = anual.filter((t) => t.total > 0);

    return (
        <Card className="w-full sm:w-64 sm:aspect-square sm:justify-center">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de gastos fijos por mes
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {mensualConMonto.length ? (
                    <div className="space-y-1">
                        {mensualConMonto.map((t) => (
                            <p key={t.moneda} className="text-3xl font-bold tracking-tight">
                                {formatCurrency(t.total, t.moneda)}
                                <span className="ml-1.5 text-sm font-normal text-muted-foreground">{t.moneda}</span>
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No hay gastos fijos mensuales activos.</p>
                )}

                {anualConMonto.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Más gastos anuales:{' '}
                        {anualConMonto.map((t) => formatCurrency(t.total, t.moneda)).join(' + ')} por año
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
