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
    // pagos deja de tener un estado propio: ahora es un recibo puro
    // ("dinero que entró"), lo que se debe vive en `cargos`.
    pgm.dropColumn('pagos', 'estado');
    pgm.dropType('estado_pago');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.createType('estado_pago', ['PENDIENTE', 'PAGADO', 'VENCIDO']);
    pgm.addColumn('pagos', {
        estado: { type: 'estado_pago', notNull: true, default: 'PAGADO' },
    });
};
