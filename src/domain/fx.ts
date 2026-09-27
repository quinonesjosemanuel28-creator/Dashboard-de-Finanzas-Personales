/**
 * Tipo de cambio. SPEC §5.1. TC = ARS por USD, oficial venta.
 */

import { Decimal, redondear2 } from "./decimal";
import { type Fecha, compararFechas, diasEntre } from "./fechas";

export type Moneda = "ARS" | "USD";

/** Días corridos sin actualizar a partir de los cuales el TC se considera desactualizado. */
export const MAX_DIAS_TC_SIN_ACTUALIZAR = 4;

/** USD = ARS / TC; ARS = USD × TC. */
export function convertir(monto: Decimal.Value, de: Moneda, a: Moneda, tc: Decimal.Value): Decimal {
  const m = new Decimal(monto);
  if (de === a) return redondear2(m);
  const t = new Decimal(tc);
  if (t.lte(0)) throw new Error("El tipo de cambio tiene que ser mayor a cero");
  return redondear2(de === "ARS" ? m.div(t) : m.mul(t));
}

/** Alerta "TC desactualizado": no hay TC o pasaron más de 4 días corridos. */
export function tcDesactualizado(fechaUltimoTC: Fecha | null, hoy: Fecha): boolean {
  if (fechaUltimoTC === null) return true;
  return diasEntre(fechaUltimoTC, hoy) > MAX_DIAS_TC_SIN_ACTUALIZAR;
}

/**
 * TC vigente para una fecha: el de esa fecha o, si no hay (fin de semana,
 * feriado), el último disponible anterior. `null` si no hay ninguno anterior.
 */
export function tcVigente<T extends { fecha: Fecha }>(tcs: T[], fecha: Fecha): T | null {
  let mejor: T | null = null;
  for (const tc of tcs) {
    if (compararFechas(tc.fecha, fecha) <= 0 && (mejor === null || compararFechas(tc.fecha, mejor.fecha) > 0)) {
      mejor = tc;
    }
  }
  return mejor;
}
