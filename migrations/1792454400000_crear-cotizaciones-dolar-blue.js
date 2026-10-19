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
    // Histórico diario del dólar blue (ver src/lib/cotizacion-dolar.ts): se
    // llena desde la API gratuita de argentinadatos.com y se completa el día
    // de hoy con dolarapi.com. Guardarlo acá en vez de consultar la API en
    // cada render hace que un mes ya cerrado nunca cambie sus números, y que
    // la app no dependa de que la API esté arriba. "compra" es el valor que
    // se usa para pasar a pesos lo que entra o sale en USD (es a lo que
    // efectivamente se venden los dólares); "venta" se guarda sólo como dato.
    pgm.createTable('cotizaciones_dolar_blue', {
        fecha: { type: 'date', primaryKey: true },
        compra: { type: 'numeric(12,2)', notNull: true },
        venta: { type: 'numeric(12,2)', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // Parte en USD del Facturado de un reparto, ya pasada a pesos (cada
    // cargo con el blue compra del día en que se pagó, o del día en que se
    // generó el reparto si todavía no se pagó). Desde que existe, el reparto
    // es todo en pesos: sueldos/gastos *_usd quedan en 0 y la base del
    // 30/30/40 es facturado_ars + facturado_usd_en_ars. Los repartos viejos
    // no tuvieron Facturado en USD, así que 0 es su valor correcto.
    pgm.addColumn('repartos_mensuales', {
        facturado_usd_en_ars: { type: 'numeric(14,2)', notNull: true, default: 0 },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('repartos_mensuales', 'facturado_usd_en_ars');
    pgm.dropTable('cotizaciones_dolar_blue');
};
