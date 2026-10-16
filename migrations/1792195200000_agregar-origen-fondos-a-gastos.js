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
    // De dónde salió la plata de cada gasto: la cuenta (a donde va el 30% de
    // gastos de cada reparto — la gran mayoría) o la caja de ahorro (compras
    // grandes). Es lo que decide si un gasto descuenta de "Plata disponible
    // en cuenta" o de "Caja de ahorro" (ver balance-mensual/queries.ts).
    //
    // Nullable a propósito: los gastos sueltos cargados antes de esto no
    // dicen de dónde salieron, y hasta ahora no se descontaban de ningún
    // lado — se dejan así para no cambiar retroactivamente los saldos. Todo
    // gasto nuevo sí lo trae (obligatorio en el formulario; los que genera
    // un gasto fijo, siempre CUENTA).
    pgm.createType('origen_fondos', ['CUENTA', 'CAJA_AHORRO']);
    pgm.addColumn('gastos', {
        origen_fondos: { type: 'origen_fondos' },
    });

    // Los gastos generados por un gasto fijo ya se descontaban de la cuenta:
    // se marcan explícitamente, así siguen descontándose aunque después se
    // borre el gasto fijo (gasto_fijo_id tiene ON DELETE SET NULL).
    pgm.sql(`UPDATE gastos SET origen_fondos = 'CUENTA' WHERE gasto_fijo_id IS NOT NULL`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('gastos', 'origen_fondos');
    pgm.dropType('origen_fondos');
};
