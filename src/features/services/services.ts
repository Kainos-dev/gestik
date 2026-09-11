// src/features/servicios/services.ts
import { EstadoRenovacionServicio, EstadoServicio, FrecuenciaServicio } from "./types";

/**
 * Calcula el próximo vencimiento a partir de la fecha de inicio y la frecuencia.
 * UNICO no vence, así que devuelve null.
 */
export function calcularProximoVencimiento(
  fechaInicio: Date,
  frecuencia: FrecuenciaServicio,
): Date | null {
  if (frecuencia === "UNICO") return null;

  const proximo = new Date(fechaInicio);
  if (frecuencia === "MENSUAL") proximo.setMonth(proximo.getMonth() + 1);
  if (frecuencia === "ANUAL") proximo.setFullYear(proximo.getFullYear() + 1);
  return proximo;
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
