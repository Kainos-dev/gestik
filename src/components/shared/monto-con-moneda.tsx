// src/components/shared/monto-con-moneda.tsx
import { Moneda, formatCurrency } from '@/lib/moneda';

// Monto con la moneda escrita al lado ("$ 34.727 ARS") — formatCurrency
// solo pone "$" para pesos, que a simple vista se confunde con dólares en
// tablas donde se mezclan las dos monedas (ej. gastos y gastos fijos).
export function MontoConMoneda({ monto, moneda }: { monto: number; moneda: Moneda }) {
    return (
        <span className="whitespace-nowrap">
            {formatCurrency(monto, moneda)}{' '}
            <span className="text-xs font-medium text-muted-foreground">{moneda}</span>
        </span>
    );
}
