// src/features/pagos/services.ts
import { EstadoPagoGuardado, EstadoPagoMostrado } from './types';

/**
 * Calcula el estado "real" a mostrar en la UI: si está PENDIENTE y la fecha
 * ya pasó, se muestra como VENCIDO. PAGADO nunca cambia.
 */
export function calcularEstadoMostrado(estado: EstadoPagoGuardado, fecha: Date): EstadoPagoMostrado {
    if (estado === 'PAGADO') return 'PAGADO';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaPago = new Date(fecha);
    fechaPago.setHours(0, 0, 0, 0);

    return fechaPago < hoy ? 'VENCIDO' : 'PENDIENTE';
}