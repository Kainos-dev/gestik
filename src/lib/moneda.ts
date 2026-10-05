// Moneda es transversal a varias features (servicios, pagos, cargos, gastos),
// a diferencia de los demás enums que declara cada schema.ts por separado —
// por eso vive acá como fuente única en vez de repetirse 4 veces.
export const MONEDAS = ['ARS', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const MONEDA_LABELS: Record<Moneda, string> = {
    ARS: 'Pesos (ARS)',
    USD: 'Dólares (USD)',
};

// minimumFractionDigits: 0 saca el ",00" cuando el monto es un número
// redondo (la inmensa mayoría de los precios acá) pero conserva los
// centavos reales cuando existen (ej. una conversión de deuda con tipo de
// cambio no siempre cae en un número entero).
export function formatCurrency(value: number, moneda: Moneda): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
}
