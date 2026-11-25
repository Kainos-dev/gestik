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
    // Anulación reversible, genérica para cualquier tabla de operaciones.
    // Anular = copiar la fila completa (to_jsonb) acá y sacarla de su tabla,
    // en una sola transacción. Así todas las consultas que ya leen esa tabla
    // (caja, Balance Mensual, Gestión, saldos de cargos…) dejan de contarla
    // sin tener que agregarles un filtro a cada una. Restaurar = volver a
    // insertarla tal cual (jsonb_populate_record), con su mismo id, fecha,
    // montos y cotización histórica, y marcar restaurado_at.
    //
    // "tabla" se limita con un CHECK a las tablas que ya soportan anulación
    // (por ahora sólo pagos); se amplía con una migración cuando se sume otra.
    pgm.createTable('registros_anulados', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        tabla: { type: 'text', notNull: true, check: "tabla IN ('pagos')" },
        registro_id: { type: 'text', notNull: true },
        datos: { type: 'jsonb', notNull: true },
        motivo: { type: 'text', notNull: true, check: "btrim(motivo) <> ''" },
        anulado_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        restaurado_at: { type: 'timestamptz' },
    });
    // Un mismo registro no puede estar anulado dos veces a la vez (sí puede
    // anularse, restaurarse y volver a anularse: cada vez es una fila nueva).
    pgm.createIndex('registros_anulados', ['tabla', 'registro_id'], {
        name: 'registros_anulados_vigente_unico',
        unique: true,
        where: 'restaurado_at IS NULL',
    });

    // Auditoría de ediciones: la fila completa antes y después de cada cambio.
    pgm.createTable('historial_ediciones', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        tabla: { type: 'text', notNull: true },
        registro_id: { type: 'text', notNull: true },
        datos_anteriores: { type: 'jsonb', notNull: true },
        datos_nuevos: { type: 'jsonb', notNull: true },
        editado_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('historial_ediciones', ['tabla', 'registro_id']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // OJO: bajar esta migración pierde la auditoría, y los cobros que estén
    // anulados en ese momento se pierden con ella (ya no están en pagos).
    // Restaurarlos antes de bajarla.
    pgm.dropTable('historial_ediciones');
    pgm.dropTable('registros_anulados');
};
