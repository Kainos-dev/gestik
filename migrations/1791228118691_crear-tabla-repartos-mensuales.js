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
    // Reparto mensual del "Facturado del mes" (ver getCargosFacturadoMes en
    // dashboard/queries.ts) en sueldos (30%) / ahorro (50%) / cuenta de
    // gastos fijos y deudas (20%) — una fila por mes, generada el 1º del
    // mes SIGUIENTE al que corresponde (ver renovar-repartos-mensuales,
    // mismo patrón catch-up que renovar-servicios/renovar-gastos-fijos).
    //
    // "facturado_ars"/"facturado_usd" quedan congelados acá (snapshot del
    // momento en que se generó el reparto) para que el reparto de un mes ya
    // cerrado no cambie retroactivamente si después se edita un pago viejo.
    //
    // Sueldos y gastos_deudas se guardan separados por moneda (ARS y USD
    // cada uno, sin convertir) — sólo el ahorro se funde en una sola cifra
    // en pesos ("ahorro_mes_ars"), porque físicamente se guarda en reservas
    // de Mercado Pago (que es en pesos). "tipo_cambio" es el valor manual
    // (ARS por USD) usado para convertir la porción de ahorro en dólares;
    // sólo es obligatorio cuando facturado_usd > 0 (se valida en el server
    // action, no acá, porque la condición depende de otra columna).
    pgm.createTable('repartos_mensuales', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        mes: { type: 'date', notNull: true, unique: true },
        facturado_ars: { type: 'numeric(12,2)', notNull: true },
        facturado_usd: { type: 'numeric(12,2)', notNull: true },
        tipo_cambio: { type: 'numeric(12,4)' },
        sueldos_ars: { type: 'numeric(12,2)', notNull: true },
        sueldos_usd: { type: 'numeric(12,2)', notNull: true },
        gastos_deudas_ars: { type: 'numeric(12,2)', notNull: true },
        gastos_deudas_usd: { type: 'numeric(12,2)', notNull: true },
        ahorro_mes_ars: { type: 'numeric(12,2)', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('repartos_mensuales', 'mes');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('repartos_mensuales');
};
