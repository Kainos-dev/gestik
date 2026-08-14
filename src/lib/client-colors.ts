// src/lib/client-colors.ts
// Paleta curada para identificar clientes de un vistazo en tablas y listados
// (servicios, pagos, cargos, etc). Colores elegidos para ser distinguibles
// entre sí y no confundirse con los badges de estado (verde/amarillo/rojo de
// ESTADO_STYLES en constants.ts).
export const CLIENT_COLOR_PALETTE = [
    '#f97316', // orange
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#eab308', // yellow
    '#6366f1', // indigo
    '#ef4444', // red
    '#22c55e', // green
    '#06b6d4', // cyan
    '#f43f5e', // rose
    '#84cc16', // lime
    '#8b5cf6', // violet
    '#0ea5e9', // sky
    '#d946ef', // fuchsia
    '#78716c', // stone
] as const;

// Asigna colores de forma rotativa según el orden de alta, para minimizar
// colisiones entre clientes creados uno después del otro sin depender de
// azar puro (dos clientes seguidos nunca comparten color mientras haya
// menos clientes que colores en la paleta).
export function pickClientColor(cantidadClientesExistentes: number): string {
    return CLIENT_COLOR_PALETTE[cantidadClientesExistentes % CLIENT_COLOR_PALETTE.length];
}
