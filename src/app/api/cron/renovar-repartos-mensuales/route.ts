// src/app/api/cron/renovar-repartos-mensuales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renovarRepartosMensuales } from '@/features/balance-mensual/actions';

// Mismo esquema de auth que /api/cron/renovar-servicios y
// /api/cron/renovar-gastos-fijos: Vercel inyecta "Authorization: Bearer
// $CRON_SECRET" automáticamente, sin pasar por el PIN de sesión (excluido
// del matcher en src/proxy.ts).
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('Falta la variable de entorno CRON_SECRET');

    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const resultado = await renovarRepartosMensuales();
    return NextResponse.json(resultado);
}
