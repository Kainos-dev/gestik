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
    // Un saldo inicial puede ser 0 (una cuenta que arranca vacía); los
    // ingresos y retiros manuales siguen teniendo que ser mayores a 0.
    pgm.sql(`ALTER TABLE movimientos_cuenta DROP CONSTRAINT IF EXISTS movimientos_cuenta_monto_check`);
    pgm.sql(`ALTER TABLE movimientos_cuenta ADD CONSTRAINT movimientos_cuenta_monto_check
             CHECK (monto > 0 OR (tipo = 'SALDO_INICIAL' AND monto = 0))`);

    // Decisión del equipo: la caja de ahorro no arrastra lo calculado por
    // los repartos viejos — arranca en 0 el 01/11/2026 y se carga a mano.
    pgm.sql(`
        UPDATE movimientos_cuenta
        SET monto = 0, fecha = '2026-11-01'
        WHERE cuenta = 'CAJA_AHORRO' AND tipo = 'SALDO_INICIAL'
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        UPDATE movimientos_cuenta
        SET monto = 872000, fecha = '2026-10-30'
        WHERE cuenta = 'CAJA_AHORRO' AND tipo = 'SALDO_INICIAL'
    `);
    pgm.sql(`ALTER TABLE movimientos_cuenta DROP CONSTRAINT IF EXISTS movimientos_cuenta_monto_check`);
    pgm.sql(`ALTER TABLE movimientos_cuenta ADD CONSTRAINT movimientos_cuenta_monto_check CHECK (monto > 0)`);
};
