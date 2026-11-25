// src/app/api/servicios/por-cliente/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiciosParaSelector } from '@/features/pagos/queries';

export async function GET(request: NextRequest) {
    const clienteId = request.nextUrl.searchParams.get('clienteId');
    if (!clienteId) return NextResponse.json([], { status: 400 });

    // Al editar un pago, su propio monto no cuenta para el saldo pendiente.
    const excluirPagoId = request.nextUrl.searchParams.get('excluirPagoId');
    const servicios = await getServiciosParaSelector(clienteId, excluirPagoId);
    return NextResponse.json(servicios);
}
