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
    // Movimientos cargados a mano en "Plata disponible en cuenta" (ver
    // balance-mensual/queries.ts):
    // - SALDO_INICIAL: punto de partida del saldo. La cuenta se calcula desde
    //   el último saldo inicial; todo lo anterior a su fecha se ignora.
    // - INGRESO / RETIRO: plata que entra o sale de la cuenta por fuera de
    //   los pagos, gastos y reposiciones de deuda que ya registra el sistema.
    // "monto" siempre positivo, en pesos: el signo lo da el tipo.
    pgm.createType('tipo_movimiento_cuenta', ['SALDO_INICIAL', 'INGRESO', 'RETIRO']);
    pgm.createTable('movimientos_cuenta', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        tipo: { type: 'tipo_movimiento_cuenta', notNull: true },
        fecha: { type: 'date', notNull: true },
        monto: { type: 'numeric(14,2)', notNull: true, check: 'monto > 0' },
        descripcion: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // Saldo de arranque elegido por el equipo para empezar a llevar la
    // cuenta en noviembre 2026: ya incluye lo que aportaba el reparto de octubre.
    pgm.sql(`
        INSERT INTO movimientos_cuenta (tipo, fecha, monto, descripcion)
        VALUES ('SALDO_INICIAL', '2026-11-01', 31900, 'Saldo inicial')
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('movimientos_cuenta');
    pgm.dropType('tipo_movimiento_cuenta');
};
