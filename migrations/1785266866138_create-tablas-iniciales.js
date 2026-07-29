// migrations/xxxxxxx_create-tablas-iniciales.js
exports.up = (pgm) => {
    pgm.createType('estado_cliente', ['ACTIVO', 'PAUSADO', 'FINALIZADO']);
    pgm.createType('tipo_servicio', ['DESARROLLO_WEB', 'MANTENIMIENTO', 'HOSTING', 'SEO', 'DISENO', 'OTRO']);
    pgm.createType('frecuencia_servicio', ['UNICO', 'MENSUAL', 'ANUAL']);
    pgm.createType('estado_servicio', ['ACTIVO', 'PAUSADO', 'FINALIZADO']);
    pgm.createType('estado_pago', ['PENDIENTE', 'PAGADO', 'VENCIDO']);
    pgm.createType('metodo_pago', ['TRANSFERENCIA', 'EFECTIVO', 'MERCADO_PAGO', 'TARJETA', 'OTRO']);

    pgm.createTable('clientes', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        nombre: { type: 'text', notNull: true },
        empresa: { type: 'text' },
        email: { type: 'text' },
        whatsapp: { type: 'text' },
        estado: { type: 'estado_cliente', notNull: true, default: 'ACTIVO' },
        fecha_alta: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        observaciones: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('clientes', 'estado');
    pgm.createIndex('clientes', 'nombre');

    pgm.createTable('servicios', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        cliente_id: { type: 'text', notNull: true, references: 'clientes', onDelete: 'CASCADE' },
        tipo: { type: 'tipo_servicio', notNull: true },
        nombre_personalizado: { type: 'text' },
        precio: { type: 'numeric(12,2)', notNull: true },
        frecuencia: { type: 'frecuencia_servicio', notNull: true },
        fecha_inicio: { type: 'timestamptz', notNull: true },
        proximo_vencimiento: { type: 'timestamptz' },
        estado: { type: 'estado_servicio', notNull: true, default: 'ACTIVO' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('servicios', 'cliente_id');
    pgm.createIndex('servicios', 'proximo_vencimiento');
    pgm.createIndex('servicios', 'estado');

    pgm.createTable('pagos', {
        id: { type: 'text', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        cliente_id: { type: 'text', notNull: true, references: 'clientes' },
        servicio_id: { type: 'text', references: 'servicios' },
        fecha: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        monto: { type: 'numeric(12,2)', notNull: true },
        metodo_pago: { type: 'metodo_pago', notNull: true },
        estado: { type: 'estado_pago', notNull: true, default: 'PENDIENTE' },
        comprobante_url: { type: 'text' },
        notas: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('pagos', 'cliente_id');
    pgm.createIndex('pagos', 'estado');
    pgm.createIndex('pagos', 'fecha');
};

exports.down = (pgm) => {
    pgm.dropTable('pagos');
    pgm.dropTable('servicios');
    pgm.dropTable('clientes');
    pgm.dropType('metodo_pago');
    pgm.dropType('estado_pago');
    pgm.dropType('estado_servicio');
    pgm.dropType('frecuencia_servicio');
    pgm.dropType('tipo_servicio');
    pgm.dropType('estado_cliente');
};