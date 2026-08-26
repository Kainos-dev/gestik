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
    // Integrantes de Kainos: no existe ningún concepto de usuario en la app
    // (el login es un PIN compartido), así que esta tabla nace acá solo para
    // poder decir "quién puso la plata" en una deuda.
    pgm.createTable('integrantes', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        nombre: { type: 'text', notNull: true },
        activo: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // Deudas: una compra/inversión pagada con plata propia de un integrante,
    // que la empresa le repone de a poco (ver reposiciones_deuda). No tiene
    // "estado" persistido: se deriva de monto_total vs. lo repuesto, igual
    // que estado_cargo/estado_pago_gasto_fijo (ver calcularEstadoDeuda).
    pgm.createTable('deudas', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        integrante_id: { type: 'text', notNull: true, references: 'integrantes' },
        descripcion: { type: 'text', notNull: true },
        monto_total: { type: 'numeric(12,2)', notNull: true },
        moneda: { type: 'moneda', notNull: true },
        fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('deudas', 'integrante_id');
    pgm.createIndex('deudas', 'fecha');

    // Reposiciones: cada vez que se le devuelve plata a un integrante por una
    // deuda. "monto" es lo que se acredita a la deuda EN SU PROPIA MONEDA (lo
    // que hace avanzar la barra de progreso); "moneda_pago"/"monto_pagado" es
    // lo que realmente salió del bolsillo (lo que descuenta del balance
    // mensual). Cuando difieren, tipo_cambio guarda la conversión manual
    // usada en ese momento (siempre expresado como "cuántos ARS vale 1 USD").
    pgm.createTable('reposiciones_deuda', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        deuda_id: { type: 'text', notNull: true, references: 'deudas', onDelete: 'CASCADE' },
        monto: { type: 'numeric(12,2)', notNull: true },
        moneda_pago: { type: 'moneda', notNull: true },
        monto_pagado: { type: 'numeric(12,2)', notNull: true },
        tipo_cambio: { type: 'numeric(12,4)' },
        fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('reposiciones_deuda', 'deuda_id');
    pgm.createIndex('reposiciones_deuda', 'fecha');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('reposiciones_deuda');
    pgm.dropTable('deudas');
    pgm.dropTable('integrantes');
};
