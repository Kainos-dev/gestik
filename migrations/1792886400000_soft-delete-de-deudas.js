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
    // Eliminación lógica de deudas: un DELETE real arrastraría sus
    // reposiciones (reposiciones_deuda tiene ON DELETE CASCADE) y con ellas
    // plata que de verdad salió de la cuenta. Con eliminada_at la deuda deja
    // de verse en la pestaña Deudas pero sus reposiciones siguen contando en
    // Balance Mensual / Gestión, y se puede restaurar (eliminada_at = NULL).
    // Columna nullable sin default: no toca ninguna fila existente.
    pgm.addColumn('deudas', {
        eliminada_at: { type: 'timestamptz' },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    // OJO: bajar esta migración hace reaparecer como activas todas las
    // deudas que se hayan eliminado (se pierde la marca, no la deuda).
    pgm.dropColumn('deudas', 'eliminada_at');
};
