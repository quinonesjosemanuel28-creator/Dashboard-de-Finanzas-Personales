/**
 * Pagos (pasivos) y cobros (activos) de cuotas. SPEC §5.4.
 * Lo pagado se aplica primero al interés y después al capital.
 */

import { CERO, Decimal } from "./decimal";
import { type EstadoCuota, estadoCuota } from "./cuotas";
import { type Fecha, type Periodo, periodoDe } from "./fechas";

export interface CuotaPagable {
  interes: Decimal.Value;
  capital: Decimal.Value;
  montoPagado: Decimal.Value;
  fechaVencimiento: Fecha;
}

/** Total de la cuota (interés + capital). */
export function totalCuota(c: Pick<CuotaPagable, "interes" | "capital">): Decimal {
  return new Decimal(c.interes).add(c.capital);
}

/** Lo que falta pagar de la cuota. */
export function pendienteCuota(c: CuotaPagable): Decimal {
  const p = totalCuota(c).sub(c.montoPagado);
  return p.gt(0) ? p : CERO;
}

/**
 * Reparte un pago nuevo entre interés y capital, según lo ya pagado.
 * Ejemplo: cuota interés 400 + capital 1000, ya pagado 300, paga 500 → 100 interés y 400 capital.
 */
export function repartirPago(c: CuotaPagable, monto: Decimal.Value): { interes: Decimal; capital: Decimal } {
  const pago = new Decimal(monto);
  if (pago.lte(0)) throw new Error("El monto del pago tiene que ser mayor a cero");
  if (pago.gt(pendienteCuota(c))) throw new Error("El pago supera lo que falta pagar de la cuota");
  const interesPendiente = Decimal.max(CERO, new Decimal(c.interes).sub(c.montoPagado));
  const interes = Decimal.min(pago, interesPendiente);
  return { interes, capital: pago.sub(interes) };
}

/** Estado y acumulado de la cuota después de registrar un pago. */
export function aplicarPago(
  c: CuotaPagable,
  monto: Decimal.Value,
  hoy: Fecha,
): { montoPagado: Decimal; estado: EstadoCuota } {
  repartirPago(c, monto); // valida
  const montoPagado = new Decimal(c.montoPagado).add(monto);
  return { montoPagado, estado: estadoCuota({ ...c, montoPagado }, hoy) };
}

/**
 * Para cargar un mutuo en curso: marca como pagadas las cuotas cuya fecha de
 * pago cae en `hasta` (YYYY-MM) o antes. No genera movimientos.
 */
export function marcarPagadasHasta<T extends CuotaPagable>(
  cuotas: T[],
  hasta: Periodo | null,
  hoy: Fecha,
): (T & { montoPagado: Decimal; estado: EstadoCuota; fechaPago: Fecha | null })[] {
  return cuotas.map((c) => {
    const pagada = hasta !== null && periodoDe(c.fechaVencimiento) <= hasta;
    const montoPagado = pagada ? totalCuota(c) : new Decimal(c.montoPagado);
    return {
      ...c,
      montoPagado,
      estado: estadoCuota({ ...c, montoPagado }, hoy),
      fechaPago: pagada ? c.fechaVencimiento : null,
    };
  });
}

/** Parte de capital ya pagada de una cuota (lo pagado va primero al interés). */
export function capitalPagadoCuota(c: Pick<CuotaPagable, "interes" | "capital" | "montoPagado">): Decimal {
  const sobreInteres = new Decimal(c.montoPagado).sub(c.interes);
  if (sobreInteres.lte(0)) return CERO;
  return Decimal.min(sobreInteres, new Decimal(c.capital));
}

/** Capital todavía no devuelto de un pasivo (o no cobrado de un activo). */
export function capitalPendiente(
  capital: Decimal.Value,
  cuotas: Pick<CuotaPagable, "interes" | "capital" | "montoPagado">[],
): Decimal {
  const pagado = cuotas.reduce((s, c) => s.add(capitalPagadoCuota(c)), CERO);
  return Decimal.max(CERO, new Decimal(capital).sub(pagado));
}
