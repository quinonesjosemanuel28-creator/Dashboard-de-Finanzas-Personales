/**
 * Conversión de lo que se tipea en los formularios (formato es-AR) a strings
 * decimales para Decimal. Nunca pasa por `number`.
 */

import { Decimal } from "@/domain/decimal";

const RE_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * "1.234.567,89" → "1234567.89"; "10000" → "10000"; "1545,5" → "1545.5".
 * Sin coma, los puntos seguidos de grupos de 3 dígitos son de miles
 * ("10.000" → "10000"); si no, el punto es decimal ("1545.50" → "1545.50").
 * Devuelve null si no es un número válido.
 */
export function parseNumeroAR(texto: string): string | null {
  let s = texto.trim().replace(/\s/g, "").replace(/^(ARS|USD)/i, "");
  if (s === "") return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return RE_DECIMAL.test(s) ? s : null;
}

/** Porcentaje tipeado ("4" o "4,5") → fracción ("0.04", "0.045"). */
export function parsePorcentajeAR(texto: string): string | null {
  const n = parseNumeroAR(texto.replace("%", ""));
  return n === null ? null : new Decimal(n).div(100).toFixed();
}
