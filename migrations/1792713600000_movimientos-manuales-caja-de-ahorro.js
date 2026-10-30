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
    // La caja de ahorro pasa a llevarse a mano, igual que la cuenta: deja de
    // sumar sola el 40% de cada reparto mensual. Cada movimiento manual dice
    // a cuál de las dos va (mismo enum que gastos.origen_fondos).
    pgm.addColumn('movimientos_cuenta', {
        cuenta: { type: 'origen_fondos', notNull: true, default: 'CUENTA' },
    });

    // Arranca con lo que tenía calculado hasta hoy (suma de los repartos de
    // ago/sep/oct 2026), para no perder lo ya apartado.
    pgm.sql(`
        INSERT INTO movimientos_cuenta (tipo, cuenta, fecha, monto, descripcion)
        VALUES ('SALDO_INICIAL', 'CAJA_AHORRO', '2026-10-30', 872000, 'Saldo inicial')
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`DELETE FROM movimientos_cuenta WHERE cuenta = 'CAJA_AHORRO'`);
    pgm.dropColumn('movimientos_cuenta', 'cuenta');
};
