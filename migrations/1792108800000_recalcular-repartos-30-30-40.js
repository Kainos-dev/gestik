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
    // El reparto pasa de 30% sueldos / 50% ahorro / 20% gastos fijos y
    // deudas a 30% sueldos / 30% gastos fijos y deudas / 40% ahorro (ver
    // calcularReparto en balance-mensual/services.ts). Los repartos ya
    // guardados se recalculan desde su facturado congelado para que el panel
    // no muestre "30%" al lado de un monto calculado al 20% — mismo cálculo
    // que calcularReparto, incluida la porción USD del ahorro pasada a pesos.
    pgm.sql(`
        UPDATE repartos_mensuales SET
            sueldos_ars = facturado_ars * 0.3,
            sueldos_usd = facturado_usd * 0.3,
            gastos_deudas_ars = facturado_ars * 0.3,
            gastos_deudas_usd = facturado_usd * 0.3,
            ahorro_mes_ars = facturado_ars * 0.4 + facturado_usd * 0.4 * COALESCE(tipo_cambio, 0)
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        UPDATE repartos_mensuales SET
            sueldos_ars = facturado_ars * 0.3,
            sueldos_usd = facturado_usd * 0.3,
            gastos_deudas_ars = facturado_ars * 0.2,
            gastos_deudas_usd = facturado_usd * 0.2,
            ahorro_mes_ars = facturado_ars * 0.5 + facturado_usd * 0.5 * COALESCE(tipo_cambio, 0)
    `);
};
