/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

// Misma paleta que src/lib/client-colors.ts (CLIENT_COLOR_PALETTE) — se
// duplica acá porque las migraciones no importan código de la app.
const PALETA = [
    '#f97316', '#3b82f6', '#a855f7', '#ec4899',
    '#14b8a6', '#eab308', '#6366f1', '#ef4444',
    '#22c55e', '#06b6d4', '#f43f5e', '#84cc16',
    '#8b5cf6', '#0ea5e9', '#d946ef', '#78716c',
];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.addColumn('clientes', { color: { type: 'text' } });

    // Backfill: a los clientes ya existentes se les asigna un color rotando
    // la paleta según su orden de alta (fecha_alta), igual que hará el
    // alta de clientes nuevos a partir de ahora.
    pgm.sql(`
        WITH numerados AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY fecha_alta) - 1 AS idx
            FROM clientes
        )
        UPDATE clientes c
        SET color = (ARRAY[${PALETA.map((hex) => `'${hex}'`).join(', ')}])[(n.idx % ${PALETA.length}) + 1]
        FROM numerados n
        WHERE n.id = c.id
    `);

    pgm.alterColumn('clientes', 'color', { notNull: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('clientes', 'color');
};
