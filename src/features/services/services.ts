// src/features/servicios/services.ts
import { FrecuenciaServicio } from "./types";

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
