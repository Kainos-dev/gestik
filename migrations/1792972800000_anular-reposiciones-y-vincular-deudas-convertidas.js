export const up = (pgm) => {
    pgm.addColumn('reposiciones_deuda', {
        anulada_at: { type: 'timestamptz' },
        motivo_anulacion: { type: 'text' },
    });
    pgm.addColumn('deudas', {
        deuda_reemplazo_id: { type: 'text', references: 'deudas' },
    });
    pgm.addConstraint('deudas', 'deuda_convertida_archivada', {
        check: 'deuda_reemplazo_id IS NULL OR (eliminada_at IS NOT NULL AND deuda_reemplazo_id <> id)',
    });
};

export const down = (pgm) => {
    pgm.dropConstraint('deudas', 'deuda_convertida_archivada');
    pgm.dropColumn('deudas', 'deuda_reemplazo_id');
    pgm.dropColumn('reposiciones_deuda', ['anulada_at', 'motivo_anulacion']);
};
