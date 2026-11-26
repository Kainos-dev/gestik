// src/features/deudas/components/deudas-totales.tsx
import { TotalesDeudas } from '../queries';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/moneda';

// Una tarjeta por métrica (no por moneda): el título aclara el propósito de
// la tarjeta y, adentro, una línea por cada moneda que tenga al menos una
// deuda, con la frase repetida en la propia línea ("... total en ARS") para
// que cada línea también se entienda sola si se la mira suelta.
function TarjetaTotal({
    label,
    frase,
    valores,
}: {
    label: string;
    frase: string;
    valores: { moneda: TotalesDeudas['moneda']; value: number }[];
}) {
    // Compacta, con la misma escala que la franja "Total de Gastos Fijos por
    // Mes": título chico arriba e importe destacado; si el ancho no alcanza, la
    // frase baja al renglón siguiente en vez de desbordar.
    return (
        <Card size="sm" className="py-3">
            <CardContent className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                {valores.map((v) => (
                    <p key={v.moneda} className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="whitespace-nowrap text-2xl font-semibold tracking-tight">
                            {formatCurrency(v.value, v.moneda)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {frase} {v.moneda}
                        </span>
                    </p>
                ))}
            </CardContent>
        </Card>
    );
}

// Resumen de toda la vida de la sección Deudas: cuánto se adeudó en total,
// cuánto falta por reponer y cuánto ya se repuso. Sólo se muestran las
// monedas que efectivamente tienen alguna deuda (ver getTotalesDeudas).
export function DeudasTotales({ totales }: { totales: TotalesDeudas[] }) {
    const conDeudas = totales.filter((t) => t.totalDeudas > 0);

    if (conDeudas.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay deudas registradas.</p>;
    }

    return (
        // Tres columnas recién desde lg: con la barra lateral, en anchos menores
        // un importe como "US$ 1.240,28" no entra y quedaría cortado.
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <TarjetaTotal
                label="Total Adeudado"
                frase="total en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalDeudas }))}
            />
            <TarjetaTotal
                label="Falta Reponer"
                frase="falta reponer en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalPendiente }))}
            />
            <TarjetaTotal
                label="Repuesto Hasta la Fecha"
                frase="se repuso en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalRepuesto }))}
            />
        </div>
    );
}
