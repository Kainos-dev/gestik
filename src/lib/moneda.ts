// Moneda es transversal a varias features (servicios, pagos, cargos, gastos),
// a diferencia de los demás enums que declara cada schema.ts por separado —
// por eso vive acá como fuente única en vez de repetirse 4 veces.
export const MONEDAS = ['ARS', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const MONEDA_LABELS: Record<Moneda, string> = {
    ARS: 'Pesos (ARS)',
    USD: 'Dólares (USD)',
};

export function formatCurrency(value: number, moneda: Moneda): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda }).format(value);
}
