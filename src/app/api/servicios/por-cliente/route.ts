// src/app/api/servicios/por-cliente/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiciosParaSelector } from '@/features/pagos/queries';

export async function GET(request: NextRequest) {
    const clienteId = request.nextUrl.searchParams.get('clienteId');
    if (!clienteId) return NextResponse.json([], { status: 400 });

    const servicios = await getServiciosParaSelector(clienteId);
    return NextResponse.json(servicios);
}