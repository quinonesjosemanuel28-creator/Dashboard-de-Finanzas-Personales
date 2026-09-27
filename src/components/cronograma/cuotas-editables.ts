/** Cronograma editable en la vista previa de altas (pasivos y activos con cronograma). */
import type { CuotaPropuesta } from "@/domain/cronograma";
import { CERO, Decimal } from "@/domain/decimal";
import { parseFecha } from "@/domain/fechas";
import type { Moneda } from "@/domain/fx";
import { formatMonto, formatNumero } from "@/lib/dinero";
import { parseNumeroAR } from "@/lib/entrada";

/** Cuota con los montos como texto editable (es-AR). */
export interface CuotaEditable {
  numero: number;
  fechaVencimiento: string;
  periodoDesde: string;
  mesesCubiertos: number;
  interes: string;
  capital: string;
}

export function aEditable(c: CuotaPropuesta): CuotaEditable {
  return {
    numero: c.numero,
    fechaVencimiento: c.fechaVencimiento,
    periodoDesde: c.periodoDesde,
    mesesCubiertos: c.mesesCubiertos,
    interes: formatNumero(c.interes),
    capital: formatNumero(c.capital),
  };
}

export function esFechaValida(f: string): boolean {
  try {
    parseFecha(f);
    return true;
  } catch {
    return false;
  }
}

/** Valida las cuotas editadas: montos y fechas válidos, y que devuelvan todo el capital. */
export function validarCuotas(cuotas: CuotaEditable[], capital: string, moneda: Moneda): string | null {
  let total = CERO;
  for (const c of cuotas) {
    const interes = parseNumeroAR(c.interes);
    const cap = parseNumeroAR(c.capital);
    if (interes === null || cap === null) return `Revisá los montos de la cuota ${c.numero}.`;
    if (!esFechaValida(c.fechaVencimiento)) return `Revisá la fecha de la cuota ${c.numero}.`;
    total = total.add(cap);
  }
  if (!total.eq(capital)) {
    return `Las cuotas devuelven ${formatMonto(total, moneda)} de capital y el total es ${formatMonto(capital, moneda)}.`;
  }
  return null;
}

/** Cuotas listas para enviar al servidor (montos como decimal con 2 posiciones). */
export function cuotasParaEnviar(cuotas: CuotaEditable[]) {
  return cuotas.map((c) => ({
    numero: c.numero,
    fechaVencimiento: c.fechaVencimiento,
    periodoDesde: c.periodoDesde,
    mesesCubiertos: c.mesesCubiertos,
    interes: new Decimal(parseNumeroAR(c.interes) ?? "0").toFixed(2),
    capital: new Decimal(parseNumeroAR(c.capital) ?? "0").toFixed(2),
  }));
}

export function totalInteres(cuotas: CuotaEditable[]): Decimal {
  return cuotas.reduce((s, c) => {
    const i = parseNumeroAR(c.interes);
    return i ? s.add(i) : s;
  }, CERO);
}
