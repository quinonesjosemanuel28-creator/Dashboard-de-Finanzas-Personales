/**
 * Estado de cuotas y punitorios. SPEC §5.4.
 */

import { CERO, Decimal, redondear2 } from "./decimal";
import { type Fecha, diasEntre } from "./fechas";

export type EstadoCuota = "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";

export interface CuotaParaEstado {
  interes: Decimal.Value;
  capital: Decimal.Value;
  /** Lo pagado (pasivos) o cobrado (activos) hasta ahora. */
  montoPagado: Decimal.Value;
  fechaVencimiento: Fecha;
}

/**
 * - PAGADA: se pagó el total.
 * - VENCIDA: no se pagó completa y ya pasó la fecha de pago (desde el día siguiente).
 * - PARCIAL: pago parcial dentro de término.
 * - PENDIENTE: sin pagos dentro de término.
 */
export function estadoCuota(cuota: CuotaParaEstado, hoy: Fecha): EstadoCuota {
  const total = new Decimal(cuota.interes).add(cuota.capital);
  const pagado = new Decimal(cuota.montoPagado);
  if (pagado.gte(total)) return "PAGADA";
  if (diasEntre(cuota.fechaVencimiento, hoy) > 0) return "VENCIDA";
  return pagado.gt(0) ? "PARCIAL" : "PENDIENTE";
}

/** Días de atraso: cuenta desde el día siguiente a la fecha de pago. */
export function diasDeAtraso(fechaVencimiento: Fecha, hoy: Fecha): number {
  return Math.max(0, diasEntre(fechaVencimiento, hoy));
}

/** Interés impago de una cuota. Lo pagado se aplica primero al interés. */
export function interesImpago(cuota: Pick<CuotaParaEstado, "interes" | "montoPagado">): Decimal {
  const impago = new Decimal(cuota.interes).sub(cuota.montoPagado);
  return impago.gt(0) ? impago : CERO;
}

/** Punitorio estimado = interés impago × punitorio mensual × días de atraso / 30. */
export function punitorioEstimado(
  cuota: CuotaParaEstado,
  punitorioMensual: Decimal.Value,
  hoy: Fecha,
): Decimal {
  const dias = diasDeAtraso(cuota.fechaVencimiento, hoy);
  if (dias === 0) return CERO;
  return redondear2(interesImpago(cuota).mul(punitorioMensual).mul(dias).div(30));
}
