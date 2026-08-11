/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    // MENSUAL sigue significando "mismo día del mes" (ej. Notebook nueva, vence
    // el 5 de cada mes). MENSUAL_30_DIAS es para planes que facturan a los 30
    // días exactos desde el último pago (ej. Adobe), que con el calendario de
    // por medio no siempre cae el mismo día.
    pgm.addTypeValue('frecuencia_gasto', 'MENSUAL_30_DIAS', { after: 'MENSUAL' });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // Postgres no permite quitar un valor de un enum sin recrear el tipo.
    // Bajamos los gastos fijos que ya lo usen a MENSUAL (mismo día) y dejamos
    // el valor huérfano en el enum — no rompe nada, solo queda sin uso.
    pgm.sql(`UPDATE gastos_fijos SET frecuencia = 'MENSUAL' WHERE frecuencia = 'MENSUAL_30_DIAS'`);
};
