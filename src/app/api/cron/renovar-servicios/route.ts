// src/app/api/cron/renovar-servicios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renovarServiciosVencidos } from '@/features/services/actions';

// Llamado por el cron de Vercel (ver vercel.json). Vercel inyecta
// automáticamente "Authorization: Bearer $CRON_SECRET" en la request cuando
// la env var se llama exactamente CRON_SECRET, así que no depende del PIN de
// sesión (que este endpoint no tiene, ver matcher en src/proxy.ts).
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('Falta la variable de entorno CRON_SECRET');

    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const resultado = await renovarServiciosVencidos();
    return NextResponse.json(resultado);
}
