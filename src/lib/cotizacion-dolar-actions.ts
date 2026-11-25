// src/lib/cotizacion-dolar-actions.ts
'use server';

import { resolverCotizacionBlue, ResultadoCotizacion } from '@/lib/cotizacion-dolar';

// Para mostrar en un formulario, de forma informativa, qué cotización se va
// a aplicar. El server action que guarda el movimiento la vuelve a resolver
// por su cuenta (nunca usa la que mandó el navegador).
export async function obtenerCotizacionBlue(fecha: string): Promise<ResultadoCotizacion> {
    try {
        return await resolverCotizacionBlue(fecha);
    } catch (error) {
        console.error('Error al obtener la cotización del dólar blue:', error);
        return { ok: false, error: 'No se pudo obtener la cotización del dólar blue. Probá de nuevo.' };
    }
}
