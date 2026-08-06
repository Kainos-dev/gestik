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
    // Borra los 2 pagos de prueba cargados a mano mientras se exploraba la
    // app (fechas inconsistentes con los servicios reales) — confirmado con
    // el usuario. A partir de acá el flujo de cargos/pagos arranca limpio.
    pgm.sql(`DELETE FROM pagos`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {};
