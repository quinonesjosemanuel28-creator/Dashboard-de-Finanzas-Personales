/**
 * Activos productivos: valor en balance y operaciones propias de cada
 * comportamiento. SPEC §5.6.
 */

import { CERO, Decimal } from "./decimal";
import { capitalPendiente, type CuotaPagable } from "./pagos";

export type Comportamiento = "RENTA_PROGRAMADA" | "CARTERA" | "COMPRAVENTA" | "TENENCIA";

/** Movimiento de un activo, reducido a lo que importa para valuarlo. */
export interface MovimientoActivo {
  tipo: string;
  monto: Decimal.Value;
}

export interface DatosValuacion {
  comportamiento: Comportamiento;
  capitalInicial: Decimal.Value;
  /** true si el capital inicial salió de una cuenta con un movimiento APLICACION_ACTIVO. */
  capitalInicialRegistrado: boolean;
  movimientos: MovimientoActivo[];
  /** RENTA_PROGRAMADA */
  cuotas?: Pick<CuotaPagable, "interes" | "capital" | "montoPagado">[];
  /** COMPRAVENTA: vendido → ya no está en el balance. */
  vendido?: boolean;
  /** TENENCIA */
  valuacionActual?: Decimal.Value | null;
  /** INCOBRABLE, CERRADO o ARCHIVADO con todo dado de baja. */
  estado?: string;
}

const suma = (movs: MovimientoActivo[], tipo: string) =>
  movs.filter((m) => m.tipo === tipo).reduce((s, m) => s.add(m.monto), CERO);

/** Capital inicial que no pasó por un movimiento (activo cargado ya en curso). */
function base(d: DatosValuacion): Decimal {
  return d.capitalInicialRegistrado ? CERO : new Decimal(d.capitalInicial);
}

/**
 * Valor del activo en el balance (SPEC §5.6):
 * - RENTA_PROGRAMADA: capital pendiente de cobro según el cronograma, menos bajas.
 * - CARTERA: capital aplicado neto (aportes − retiros − bajas).
 * - COMPRAVENTA: costo total (compra + gastos directos) mientras está en stock; 0 vendido.
 * - TENENCIA: valuación actual (o el costo si todavía no se valuó).
 */
export function valorActivo(d: DatosValuacion): Decimal {
  const movs = d.movimientos;
  const bajas = suma(movs, "BAJA_INCOBRABLE");
  switch (d.comportamiento) {
    case "RENTA_PROGRAMADA": {
      const pendiente = capitalPendiente(d.capitalInicial, d.cuotas ?? []);
      return Decimal.max(CERO, pendiente.sub(bajas));
    }
    case "CARTERA": {
      const aplicado = base(d).add(suma(movs, "APLICACION_ACTIVO"));
      return Decimal.max(CERO, aplicado.sub(suma(movs, "COBRO_CAPITAL")).sub(bajas));
    }
    case "COMPRAVENTA":
      return d.vendido ? CERO : costoCompraventa(d);
    case "TENENCIA": {
      if (d.valuacionActual !== null && d.valuacionActual !== undefined) return new Decimal(d.valuacionActual);
      return base(d).add(suma(movs, "APLICACION_ACTIVO")).sub(suma(movs, "COBRO_CAPITAL")).sub(bajas);
    }
  }
}

/** Costo total de una compraventa: compra + gastos directos (se capitalizan). */
export function costoCompraventa(d: Pick<DatosValuacion, "capitalInicial" | "capitalInicialRegistrado" | "movimientos">): Decimal {
  return base(d as DatosValuacion).add(suma(d.movimientos, "APLICACION_ACTIVO")).add(suma(d.movimientos, "GASTO"));
}

/**
 * Venta de una compraventa. Ganancia = precio − costo.
 * - Con ganancia (o sin ganancia): COBRO_CAPITAL por el costo + COBRO_RENDIMIENTO por la ganancia.
 * - Con pérdida: COBRO_CAPITAL por el precio + BAJA_INCOBRABLE por la diferencia (va a Pérdidas).
 */
export function liquidarVenta(
  costo: Decimal.Value,
  precioVenta: Decimal.Value,
): { ganancia: Decimal; cobroCapital: Decimal; cobroRendimiento: Decimal; perdida: Decimal } {
  const c = new Decimal(costo);
  const p = new Decimal(precioVenta);
  if (p.isNeg()) throw new Error("El precio de venta no puede ser negativo");
  const ganancia = p.sub(c);
  if (ganancia.gte(0)) return { ganancia, cobroCapital: c, cobroRendimiento: ganancia, perdida: CERO };
  return { ganancia, cobroCapital: p, cobroRendimiento: CERO, perdida: ganancia.neg() };
}
