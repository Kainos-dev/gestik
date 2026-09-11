// src/app/api/cron/renovar-gastos-fijos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renovarGastosFijosVencidos } from '@/features/gastos/actions';

// Llamado por el cron de Vercel (ver vercel.json), mismo esquema de auth que
// /api/cron/renovar-servicios: Vercel inyecta "Authorization: Bearer
// $CRON_SECRET" automáticamente cuando la env var se llama exactamente
// CRON_SECRET, así que no depende del PIN de sesión (este endpoint está
// excluido del matcher en src/proxy.ts).
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('Falta la variable de entorno CRON_SECRET');

    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const resultado = await renovarGastosFijosVencidos();
    return NextResponse.json(resultado);
}
