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
    // Dólar cripto (DolarAPI, https://dolarapi.com/v1/dolares/cripto): estimación
    // del costo de comprar dólares en ARQ, para pasar a pesos los gastos fijos que
    // pagamos en USD. NO se usa para cobros de clientes ni reposiciones de deuda
    // (esos siguen con el blue venta, tabla cotizaciones_dolar_blue).
    // Una fila por cada actualización publicada por la API (actualizada_at es su
    // fechaActualizacion): si se consulta y el valor no cambió, no se repite.
    pgm.createTable('cotizaciones_dolar_cripto', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        compra: { type: 'numeric(14,4)', notNull: true, check: 'compra > 0' },
        venta: { type: 'numeric(14,4)', notNull: true, check: 'venta > 0' },
        actualizada_at: { type: 'timestamptz', notNull: true, unique: true },
        obtenida_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('cotizaciones_dolar_cripto');
};
