// src/features/dashboard/proyeccion.ts
// Proyección de cargos que todavía no existen (lógica pura, sin base de datos).
import { calcularProximoVencimiento, calcularVencimientoCargo } from '@/features/services/services';
import type { FrecuenciaServicio } from '@/features/services/types';
import type { ModalidadPago } from '@/features/clients/types';

export const MAX_PERIODOS_PROYECTADOS = 24;

export interface ServicioProyectable {
    proximoVencimiento: Date; // inicio del próximo período, que todavía no tiene cargo
    frecuencia: FrecuenciaServicio;
    venceFinDeMes: boolean;
    modalidadPago: ModalidadPago;
}

export interface VencimientoProyectado {
    indice: number; // cuántos períodos después de proximoVencimiento
    periodo: Date;
    vencimiento: Date;
}

/**
 * Vencimientos de los cargos de un servicio que todavía no se generaron y
 * que caen en el mes de "mes" (en UTC). Recorre los períodos desde
 * proximoVencimiento con las mismas reglas que la renovación
 * (calcularProximoVencimiento + calcularVencimientoCargo). Como arranca en
 * el primer período SIN cargo, nunca repite un cargo que ya existe, y no
 * depende de ningún pago: cobrar antes, tarde o parcial no cambia nada acá.
 */
export function vencimientosProyectadosEnMes(servicio: ServicioProyectable, mes: Date): VencimientoProyectado[] {
    if (servicio.frecuencia === 'UNICO') return [];
    const inicioMes = Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), 1);
    const inicioMesSiguiente = Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1);
    const resultado: VencimientoProyectado[] = [];

    let periodo = new Date(servicio.proximoVencimiento);
    for (let i = 0; i < MAX_PERIODOS_PROYECTADOS && periodo.getTime() < inicioMesSiguiente; i++) {
        const siguiente = calcularProximoVencimiento(periodo, servicio.frecuencia, servicio.venceFinDeMes);
        if (!siguiente) break;
        const vencimiento = calcularVencimientoCargo(periodo, siguiente, servicio.modalidadPago);
        if (vencimiento.getTime() >= inicioMes && vencimiento.getTime() < inicioMesSiguiente) {
            resultado.push({ indice: i, periodo, vencimiento });
        }
        periodo = siguiente;
    }
    return resultado;
}
