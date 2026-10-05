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
    // Mismo patrón que reposiciones_deuda (crear-tablas-deudas): "monto"/
    // "moneda" siguen siendo lo que se acredita al cargo EN LA MONEDA DEL
    // SERVICIO (lo que ya usa todo el resto del sistema — cargos, KPIs,
    // waterfall de pagos); "moneda_pago"/"monto_pagado" es lo que realmente
    // entró (ej. un servicio en USD cobrado en ARS ese mes). Cuando
    // difieren, tipo_cambio guarda la conversión manual usada en ese
    // momento (siempre "cuántos ARS vale 1 USD", igual criterio que en
    // reposiciones_deuda). Se backfillea con los valores existentes para
    // que todo pago viejo quede como "se cobró en su propia moneda, sin
    // conversión" — no se pierde ni se inventa información.
    pgm.addColumn('pagos', {
        moneda_pago: { type: 'moneda' },
        monto_pagado: { type: 'numeric(12,2)' },
        tipo_cambio: { type: 'numeric(12,4)' },
    });

    pgm.sql(`UPDATE pagos SET moneda_pago = moneda, monto_pagado = monto`);

    pgm.alterColumn('pagos', 'moneda_pago', { notNull: true });
    pgm.alterColumn('pagos', 'monto_pagado', { notNull: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumn('pagos', ['moneda_pago', 'monto_pagado', 'tipo_cambio']);
};
