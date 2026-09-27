/**
 * Formato de montos para la UI (es-AR, SPEC regla 8): 1.234.567,89 USD.
 * Trabaja sobre Decimal/strings, nunca sobre `number`.
 */
import { Decimal } from "@/domain/decimal";
import type { Moneda } from "@/domain/fx";

export const MONTO_OCULTO = "••••";

/** Formatea con separador de miles "." y decimal "," (2 decimales por defecto). */
export function formatNumero(valor: Decimal.Value, decimales = 2): string {
  const d = new Decimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP);
  const [entero = "0", fraccion] = d.abs().toFixed(decimales).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const signo = d.isNeg() && !d.isZero() ? "-" : "";
  return signo + conMiles + (fraccion ? `,${fraccion}` : "");
}

/** Monto con su moneda: "ARS 1.234.567,89" / "USD 400,00". */
export function formatMonto(valor: Decimal.Value, moneda: Moneda): string {
  return `${moneda} ${formatNumero(valor)}`;
}

/** Tasa mensual guardada como fracción (0.04) → "4,00 %". */
export function formatTasa(tasa: Decimal.Value, decimales = 2): string {
  return `${formatNumero(new Decimal(tasa).mul(100), decimales)} %`;
}
