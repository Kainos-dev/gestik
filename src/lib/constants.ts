// src/lib/constants.ts
export const ESTADO_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  // Cliente / Servicio
  ACTIVO: {
    label: "Activo",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  PAUSADO: {
    label: "Pausado",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  FINALIZADO: {
    label: "Finalizado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },

  // Pago / Cargo
  PENDIENTE: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  PARCIAL: {
    label: "Parcial",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  PAGADO: {
    label: "Pagado",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  VENCIDO: {
    label: "Vencido",
    className: "bg-red-100 text-red-700 border-red-200",
  },

  // Gasto fijo (estado de pago calculado, ver calcularEstadoPagoGastoFijo)
  AL_DIA: {
    label: "Al día",
    className: "bg-green-100 text-green-700 border-green-200",
  },
};

export const TIPO_SERVICIO_LABELS: Record<string, string> = {
  DESARROLLO_WEB: "Desarrollo Web",
  MARKETING: "Marketing",
  HOSTING: "Hosting",
  SEO: "SEO",
  DISENO: "Diseño",
  MANTENIMIENTO: "Mantenimiento",
  OTRO: "Otro",
};

export const FRECUENCIA_LABELS: Record<string, string> = {
  UNICO: "Único",
  MENSUAL: "Mensual",
  ANUAL: "Anual",
};

export const METODO_PAGO_LABELS: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};

export const CATEGORIA_GASTO_LABELS: Record<string, string> = {
  SOFTWARE: 'Software',
  HOSTING: 'Hosting',
  EQUIPAMIENTO: 'Equipamiento',
  MARKETING: 'Marketing',
  IMPUESTOS: 'Impuestos',
  OFICINA: 'Oficina',
  OTRO: 'Otro',
};