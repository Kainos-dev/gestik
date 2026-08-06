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
    pgm.createType('categoria_gasto', [
        'SOFTWARE',
        'HOSTING',
        'EQUIPAMIENTO',
        'MARKETING',
        'IMPUESTOS',
        'OFICINA',
        'OTRO',
    ]);
    pgm.createType('frecuencia_gasto', ['MENSUAL', 'ANUAL']);
    pgm.createType('estado_gasto_fijo', ['ACTIVO', 'PAUSADO', 'FINALIZADO']);

    // Gastos fijos: la definición del gasto recurrente (Adobe, hosting, etc.),
    // análogo a "servicios" pero del lado de lo que pagamos nosotros.
    pgm.createTable('gastos_fijos', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        nombre: { type: 'text', notNull: true },
        categoria: { type: 'categoria_gasto', notNull: true },
        monto: { type: 'numeric(12,2)', notNull: true },
        frecuencia: { type: 'frecuencia_gasto', notNull: true },
        fecha_inicio: { type: 'timestamptz', notNull: true },
        proximo_vencimiento: { type: 'timestamptz' },
        estado: { type: 'estado_gasto_fijo', notNull: true, default: 'ACTIVO' },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('gastos_fijos', 'estado');
    pgm.createIndex('gastos_fijos', 'proximo_vencimiento');

    // Gastos: cada salida de plata real, análogo a "pagos". gasto_fijo_id es
    // opcional: null para gastos puntuales (ej. una compu), poblado cuando es
    // la cuota del mes de un gasto fijo (ej. Adobe de agosto).
    pgm.createTable('gastos', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        gasto_fijo_id: { type: 'text', references: 'gastos_fijos', onDelete: 'SET NULL' },
        categoria: { type: 'categoria_gasto', notNull: true },
        descripcion: { type: 'text', notNull: true },
        monto: { type: 'numeric(12,2)', notNull: true },
        fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('gastos', 'fecha');
    pgm.createIndex('gastos', 'categoria');
    pgm.createIndex('gastos', 'gasto_fijo_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('gastos');
    pgm.dropTable('gastos_fijos');
    pgm.dropType('estado_gasto_fijo');
    pgm.dropType('frecuencia_gasto');
    pgm.dropType('categoria_gasto');
};
