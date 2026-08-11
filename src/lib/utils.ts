import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Para fechas "elegidas" (periodo, vencimiento, fechaInicio, proximoVencimiento):
// se guardan como medianoche UTC del día que se eligió en el form, así que hay
// que mostrarlas también en UTC para recuperar ese mismo día sin importar la
// timezone de quien mira la pantalla.
export function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

// Para timestamps reales (createdAt/updatedAt, un now() de Postgres): acá SÍ
// hay que usar la timezone local de quien mira la pantalla — forzar UTC como
// en formatDate corre el día para adelante en timezones negativas (ej.
// Argentina) para todo lo creado después de las 21:00 hora local.
export function formatDateLocal(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-AR');
}