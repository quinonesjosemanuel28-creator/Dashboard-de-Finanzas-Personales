import { z } from "zod";
import { Decimal } from "@/domain/decimal";
import { parseFecha } from "@/domain/fechas";
import { parseNumeroAR, parsePorcentajeAR } from "@/lib/entrada";

/** Resultado de una server action de formulario. */
export type ResultadoAccion =
  | { ok: true; mensaje?: string; id?: string }
  | { ok: false; error: string; campos?: Record<string, string> };

export const estadoInicial: ResultadoAccion | null = null;

/** Monto tipeado en es-AR → string decimal con 2 decimales, ≥ 0. */
export const zMonto = z
  .string()
  .transform((v, ctx) => {
    const n = parseNumeroAR(v);
    if (n === null || new Decimal(n).isNeg()) {
      ctx.addIssue({ code: "custom", message: "Ingresá un monto válido" });
      return z.NEVER;
    }
    return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  });

/** Monto estrictamente positivo. */
export const zMontoPositivo = zMonto.refine((v) => new Decimal(v).gt(0), "El monto tiene que ser mayor a cero");

/** Porcentaje tipeado ("4,5") → fracción ("0.045"). */
export const zPorcentaje = z.string().transform((v, ctx) => {
  const n = parsePorcentajeAR(v);
  if (n === null || new Decimal(n).isNeg()) {
    ctx.addIssue({ code: "custom", message: "Ingresá un porcentaje válido" });
    return z.NEVER;
  }
  return n;
});

/** Decimal ya normalizado (payloads JSON del cliente). */
export const zDecimal = z.string().refine((v) => /^-?\d+(\.\d+)?$/.test(v), "Número inválido");

export const zFecha = z.string().refine((v) => {
  try {
    parseFecha(v);
    return true;
  } catch {
    return false;
  }
}, "Fecha inválida");

export const zPeriodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido");

/** Primer error por campo, para mostrar debajo de cada input. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join(".");
    if (clave && !campos[clave]) campos[clave] = issue.message;
  }
  return campos;
}

export function falloValidacion(error: z.ZodError): ResultadoAccion {
  return { ok: false, error: "Revisá los datos marcados.", campos: erroresPorCampo(error) };
}
