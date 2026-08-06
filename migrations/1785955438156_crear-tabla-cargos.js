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
    // Cargos: "lo que se debe cobrar" — se genera al crear/renovar un servicio.
    // El monto se copia del precio del servicio en ese momento, para que un
    // cambio de precio futuro no altere retroactivamente cargos ya emitidos.
    pgm.createTable('cargos', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        cliente_id: { type: 'text', notNull: true, references: 'clientes' },
        servicio_id: { type: 'text', notNull: true, references: 'servicios' },
        periodo: { type: 'timestamptz', notNull: true },
        monto: { type: 'numeric(12,2)', notNull: true },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('cargos', 'cliente_id');
    pgm.createIndex('cargos', 'servicio_id');
    pgm.createIndex('cargos', 'periodo');
    // Evita duplicar el cargo de un mismo período (ej. doble click en "Renovar")
    pgm.addConstraint('cargos', 'cargos_servicio_periodo_unique', {
        unique: ['servicio_id', 'periodo'],
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('cargos');
};
