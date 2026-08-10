// src/features/finanzas/components/ingresos-chart.tsx
'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { IngresoMes } from '../queries';
import { MONEDAS, formatCurrency } from '@/lib/moneda';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatMes(mes: string) {
    const [, mm] = mes.split('-');
    return MESES_CORTOS[Number(mm) - 1];
}

const COLOR_POR_MONEDA = { ARS: 'hsl(var(--primary))', USD: 'hsl(var(--primary) / 0.5)' } as const;

// Un solo eje de $ no tiene sentido cuando mezcla ARS y USD, así que cada
// moneda se dibuja como su propia serie (barra), formateada con su símbolo.
export function IngresosChart({ data }: { data: IngresoMes[] }) {
    const porMes = new Map<string, Record<string, number | string>>();
    for (const d of data) {
        const mes = formatMes(d.mes);
        if (!porMes.has(mes)) porMes.set(mes, { mes });
        porMes.get(mes)![d.moneda] = d.total;
    }
    const chartData = Array.from(porMes.values());

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={90} />
                <Tooltip
                    formatter={(value, name) =>
                        typeof value === 'number' ? formatCurrency(value, name as 'ARS' | 'USD') : value
                    }
                    cursor={{ fill: 'transparent' }}
                />
                <Legend />
                {MONEDAS.map((moneda) => (
                    <Bar key={moneda} dataKey={moneda} radius={[4, 4, 0, 0]} fill={COLOR_POR_MONEDA[moneda]} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}