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
    // ANTICIPADO: el cliente paga antes de arrancar el mes de trabajo (el
    // cargo vence al inicio de su propio período). POSPAGO: paga al terminar
    // el mes (el cargo vence al arrancar el próximo período) — es el único
    // comportamiento que existía hasta ahora, ver calcularVencimientoCargo
    // en services/services.ts. Default POSPAGO para no cambiarle la
    // modalidad a nadie que ya esté trabajando bajo el esquema viejo — la
    // nueva política (cobrar antes de trabajar) sólo aplica a clientes que
    // se den de alta de acá en adelante, eligiendo explícitamente en el alta.
    pgm.createType('modalidad_pago_cliente', ['ANTICIPADO', 'POSPAGO']);
    pgm.addColumn('clientes', {
        modalidad_pago: { type: 'modalidad_pago_cliente', notNull: true, default: 'POSPAGO' },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('clientes', 'modalidad_pago');
    pgm.dropType('modalidad_pago_cliente');
};
