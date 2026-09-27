import Decimal from "decimal.js";

export { Decimal };

/** Redondeo monetario a 2 decimales, mitad hacia arriba. */
export function redondear2(valor: Decimal.Value): Decimal {
  return new Decimal(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export const CERO = new Decimal(0);
