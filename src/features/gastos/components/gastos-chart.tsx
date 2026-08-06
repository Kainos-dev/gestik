// src/features/gastos/components/gastos-chart.tsx
'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { GastoMes } from '../queries';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatMes(mes: string) {
    const [, mm] = mes.split('-');
    return MESES_CORTOS[Number(mm) - 1];
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
        value
    );
}

export function GastosChart({ data }: { data: GastoMes[] }) {
    const chartData = data.map((d) => ({ mes: formatMes(d.mes), total: d.total }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => formatCurrency(v)} width={90} />
                <Tooltip
                    formatter={(value) =>
                        typeof value === "number" ? formatCurrency(value) : value
                    }
                    cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="hsl(0 72% 51%)" />
            </BarChart>
        </ResponsiveContainer>
    );
}
