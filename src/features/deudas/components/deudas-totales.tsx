// src/features/deudas/components/deudas-totales.tsx
import { TotalesDeudas } from '../queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                {valores.map((v) => (
                    <p key={v.moneda} className="text-2xl font-semibold">
                        {formatCurrency(v.value, v.moneda)}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TarjetaTotal
                label="Total adeudado"
                frase="total en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalDeudas }))}
            />
            <TarjetaTotal
                label="Falta reponer"
                frase="falta reponer en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalPendiente }))}
            />
            <TarjetaTotal
                label="Repuesto hasta la fecha"
                frase="se repuso en"
                valores={conDeudas.map((t) => ({ moneda: t.moneda, value: t.totalRepuesto }))}
            />
        </div>
    );
}
