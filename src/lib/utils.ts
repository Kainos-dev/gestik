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

// Para pasar una fecha "elegida" (no un timestamp real) como parámetro de una
// query (ej. `$1::date`): node-pg serializa un objeto Date de JS usando sus
// getters LOCALES (no UTC) — un valor como medianoche UTC del 1º del mes
// (típico resultado de un date_trunc('month', ...)) en una timezone negativa
// (ej. Argentina, UTC-3) se relee del lado de Postgres como el día anterior,
// corriendo el mes para atrás. Convertir a un string "YYYY-MM-DD" con los
// getters UTC antes de bindearlo evita por completo esa reinterpretación
// (Postgres lo parsea literal, sin ninguna conversión de por medio).
export function dateToSqlDateString(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}