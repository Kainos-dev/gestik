// src/components/shared/importe-interpretado.tsx
'use client';

import { Control, FieldValues, Path, useWatch } from 'react-hook-form';
import { parsearImporte } from '@/lib/importe';
import { Moneda, formatCurrency } from '@/lib/moneda';

// Muestra debajo de un input de importe cómo se va a interpretar lo que se
// escribió ("100.000" → $ 100.000), o por qué no se puede leer, antes de
// confirmar la operación. Usa exactamente el mismo parser que el schema.
export function ImporteInterpretado({
    valor,
    moneda,
    decimales = 2,
    etiqueta = 'Se registra',
}: {
    valor: unknown;
    moneda?: Moneda;
    decimales?: number;
    etiqueta?: string;
}) {
    if (valor === undefined || valor === null || valor === '') return null;
    // El 0 precargado de un formulario nuevo no es algo que el usuario escribió.
    if (typeof valor === 'number' && valor === 0) return null;

    const resultado = parsearImporte(valor, { decimales });
    if (!resultado.ok) return <p className="text-xs text-red-600">{resultado.error}</p>;

    const texto = moneda
        ? formatCurrency(resultado.valor, moneda)
        : new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimales }).format(resultado.valor);
    return (
        <p className="text-xs text-muted-foreground">
            {etiqueta}: <span className="font-medium text-foreground">{texto}</span>
        </p>
    );
}

/**
 * Variante para formularios de react-hook-form: lee el campo (y, si se
 * indica, el campo de moneda) con useWatch, sin tocar los hooks del form.
 */
export function ImporteInterpretadoCampo<T extends FieldValues, C = unknown, TT = T>({
    control,
    name,
    monedaCampo,
    moneda,
    decimales,
    etiqueta,
}: {
    control: Control<T, C, TT>;
    name: Path<T>;
    monedaCampo?: Path<T>;
    moneda?: Moneda;
    decimales?: number;
    etiqueta?: string;
}) {
    const [valor, monedaElegida] = useWatch({ control, name: [name, monedaCampo ?? name] }) as [unknown, unknown];
    const monedaFinal = moneda ?? (monedaCampo && (monedaElegida === 'ARS' || monedaElegida === 'USD') ? monedaElegida : undefined);
    return <ImporteInterpretado valor={valor} moneda={monedaFinal} decimales={decimales} etiqueta={etiqueta} />;
}
