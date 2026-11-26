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
    // Porcentaje de sueldos configurable con vigencia (antes era un 30% fijo
    // en balance-mensual/services.ts). Cada fila dice "desde este mes, el
    // sueldo es X% de lo facturado"; el reparto de un mes usa la última fila
    // con vigente_desde <= ese mes. Siempre el día 1: el reparto es mensual.
    // Tope 70%: gastos (30%) queda fijo y el ahorro es lo que sobra.
    pgm.createTable('porcentajes_sueldo', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        porcentaje: { type: 'numeric(5,2)', notNull: true, check: 'porcentaje > 0 AND porcentaje <= 70' },
        vigente_desde: { type: 'date', notNull: true, unique: true, check: 'extract(day from vigente_desde) = 1' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    // El 30% de siempre, vigente desde el primer reparto que existió.
    pgm.sql(`
        INSERT INTO porcentajes_sueldo (porcentaje, vigente_desde)
        VALUES (30, COALESCE((SELECT MIN(mes) FROM repartos_mensuales), date_trunc('month', CURRENT_DATE)::date))
    `);

    // Cada reparto guarda con qué porcentaje se calculó: un cambio posterior
    // nunca reescribe un mes ya cerrado. Todos los repartos existentes se
    // generaron con 30% (lo verifica el CHECK de abajo antes de quitar el default).
    pgm.addColumn('repartos_mensuales', {
        porcentaje_sueldos: { type: 'numeric(5,2)', notNull: true, default: 30 },
    });
    pgm.sql(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM repartos_mensuales
                WHERE abs(sueldos_ars - (facturado_ars + facturado_usd_en_ars) * 0.30) > 0.01
            ) THEN
                RAISE EXCEPTION 'Hay repartos que no se calcularon con 30%%: revisar antes de migrar';
            END IF;
        END $$;
    `);
    pgm.alterColumn('repartos_mensuales', 'porcentaje_sueldos', { default: null });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('repartos_mensuales', 'porcentaje_sueldos');
    pgm.dropTable('porcentajes_sueldo');
};
