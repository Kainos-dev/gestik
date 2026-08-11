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
    // "periodo" es el inicio del ciclo (cuándo se generó el cargo); hasta
    // ahora se usaba esa misma fecha como si fuera el límite de pago, así
    // que un cargo quedaba VENCIDO al día siguiente de crearse. "vencimiento"
    // separa eso: es el inicio del PRÓXIMO período (recién ahí se considera
    // atrasado) — para servicios UNICO no hay próximo período, así que vence
    // en el propio periodo (se debe apenas se emite).
    pgm.addColumn('cargos', { vencimiento: { type: 'timestamptz' } });

    pgm.sql(`
        UPDATE cargos c
        SET vencimiento = CASE s.frecuencia
            WHEN 'MENSUAL' THEN c.periodo + INTERVAL '1 month'
            WHEN 'ANUAL' THEN c.periodo + INTERVAL '1 year'
            ELSE c.periodo
        END
        FROM servicios s
        WHERE s.id = c.servicio_id
    `);

    pgm.alterColumn('cargos', 'vencimiento', { notNull: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('cargos', 'vencimiento');
};
