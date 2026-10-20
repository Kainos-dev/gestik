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
    // Servicios que se cobran el último día de cada mes (28, 29, 30 o 31
    // según el mes) en vez de "el mismo día que la fecha de inicio". Con
    // false, cada ciclo suma un mes a la fecha anterior, como siempre; con
    // true, el próximo vencimiento es el último día del mes siguiente (ver
    // calcularProximoVencimiento en services/services.ts) — así no se corre
    // al pasar por febrero.
    pgm.addColumn('servicios', {
        vence_fin_de_mes: { type: 'boolean', notNull: true, default: false },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('servicios', 'vence_fin_de_mes');
};
