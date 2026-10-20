// src/features/servicios/services.ts
import { EstadoRenovacionServicio, EstadoServicio, FrecuenciaServicio } from "./types";

/**
 * Calcula el próximo vencimiento a partir de la fecha de inicio y la frecuencia.
 * UNICO no vence, así que devuelve null.
 */
export function calcularProximoVencimiento(
  fechaInicio: Date,
  frecuencia: FrecuenciaServicio,
  venceFinDeMes = false,
): Date | null {
  if (frecuencia === "UNICO") return null;

  // "Vence el último día del mes" (servicios.vence_fin_de_mes): el próximo
  // vencimiento es el último día del mes siguiente (o del mismo mes del año
  // que viene, si es ANUAL), sin importar qué día era la fecha anterior —
  // así nunca se corre: 31/01 → 28/02 → 31/03. Sumar un mes a mano en
  // cambio pasaría de 30/01 a 02/03 (febrero no tiene 30) y de ahí quedaría
  // corrido al 2 para siempre. En UTC, igual que se guardan las fechas.
  if (venceFinDeMes) {
    const base = new Date(fechaInicio);
    const año = base.getUTCFullYear() + (frecuencia === "ANUAL" ? 1 : 0);
    const mes = base.getUTCMonth() + (frecuencia === "MENSUAL" ? 1 : 0);
    return ultimoDiaDelMes(año, mes);
  }

  const proximo = new Date(fechaInicio);
  if (frecuencia === "MENSUAL") proximo.setMonth(proximo.getMonth() + 1);
  if (frecuencia === "ANUAL") proximo.setFullYear(proximo.getFullYear() + 1);
  return proximo;
}

// Último día del mes "mes" (0-11; si se pasa de 11, Date.UTC lo lleva al
// año siguiente) a medianoche UTC: el día 0 del mes siguiente es el último
// día de este.
export function ultimoDiaDelMes(año: number, mes: number): Date {
  return new Date(Date.UTC(año, mes + 1, 0));
}

/**
 * Recalcula el próximo vencimiento a partir de "hoy", útil para cuando
 * el vencimiento anterior ya pasó y hay que proyectar el siguiente ciclo
 * (lo vamos a reusar cuando armemos el registro de pagos).
 */
export function proyectarSiguienteVencimiento(
  vencimientoAnterior: Date,
  frecuencia: FrecuenciaServicio,
): Date | null {
  return calcularProximoVencimiento(vencimientoAnterior, frecuencia);
}

// Modalidad de pago del cliente dueño del servicio — ver MODALIDADES_PAGO en
// clients/schema.ts. Se repite acá como tipo local (en vez de importar de
// clients/types) porque servicios no necesita conocer el resto de Cliente,
// sólo este valor puntual para calcular el vencimiento del cargo.
type ModalidadPagoCliente = 'ANTICIPADO' | 'POSPAGO';

/**
 * Vencimiento del cargo de un período, según la modalidad de pago del
 * cliente: ANTICIPADO vence al arrancar el propio período (se cobra antes
 * de trabajar), POSPAGO vence al arrancar el próximo (se cobra al terminar
 * de trabajar el período actual) — éste último es el único comportamiento
 * que existía antes de que se distinguiera por cliente. Si no hay próximo
 * período (servicio UNICO), siempre vence en el propio período sin importar
 * la modalidad — no hay "trabajo por adelantado" que cobrar antes.
 */
export function calcularVencimientoCargo(
  periodoInicio: Date,
  proximoPeriodo: Date | null,
  modalidadPago: ModalidadPagoCliente,
): Date {
  if (!proximoPeriodo) return periodoInicio;
  return modalidadPago === 'ANTICIPADO' ? periodoInicio : proximoPeriodo;
}

/**
 * Estado de renovación calculado (no persistido) a partir de
 * "proximoVencimiento": mismo criterio que calcularEstadoPagoGastoFijo en
 * gastos/services.ts — VENCIDO cuando ya pasó la fecha, es decir, cuando
 * tocaba renovar y todavía nadie apretó "Renovar". Devuelve null si el
 * servicio no está ACTIVO, o si es UNICO (no tiene próximo vencimiento).
 */
export function calcularEstadoRenovacion(
  estado: EstadoServicio,
  proximoVencimiento: Date | null,
): EstadoRenovacionServicio | null {
  if (estado !== "ACTIVO" || !proximoVencimiento) return null;

  // "proximoVencimiento" se guarda como medianoche UTC del día elegido
  // (igual criterio que formatDate usa para mostrarlo), así que hay que
  // leerlo con los getters UTC acá también — truncar con setHours() local
  // lo corre un día para atrás en timezones negativos (ej. Argentina).
  const fechaVencimiento = new Date(proximoVencimiento);
  const vencimientoUTC = Date.UTC(
    fechaVencimiento.getUTCFullYear(),
    fechaVencimiento.getUTCMonth(),
    fechaVencimiento.getUTCDate(),
  );

  const hoy = new Date();
  const hoyLocal = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return vencimientoUTC < hoyLocal ? "VENCIDO" : "AL_DIA";
}
