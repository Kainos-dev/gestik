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
    pgm.createType('moneda', ['ARS', 'USD']);

    const columnaMoneda = { type: 'moneda', notNull: true, default: 'ARS' };

    // servicios: la moneda "nace" acá, todo lo demás la hereda.
    pgm.addColumn('servicios', { moneda: columnaMoneda });

    // cargos: se copia de servicios.moneda al generarse, igual que ya se
    // copia el monto — para que un cambio de moneda futuro no altere
    // retroactivamente cargos ya emitidos.
    pgm.addColumn('cargos', { moneda: columnaMoneda });

    // pagos: hereda la moneda del servicio cuando está asociado a uno; si es
    // un pago suelto (sin servicio_id) se elige manualmente en el form.
    pgm.addColumn('pagos', { moneda: columnaMoneda });

    pgm.addColumn('gastos_fijos', { moneda: columnaMoneda });
    pgm.addColumn('gastos', { moneda: columnaMoneda });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('gastos', 'moneda');
    pgm.dropColumn('gastos_fijos', 'moneda');
    pgm.dropColumn('pagos', 'moneda');
    pgm.dropColumn('cargos', 'moneda');
    pgm.dropColumn('servicios', 'moneda');
    pgm.dropType('moneda');
};
