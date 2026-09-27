/**
 * Reglas de los movimientos (SPEC §4, "Validaciones clave").
 */

import { Decimal } from "./decimal";

export type TipoMovimiento =
  | "INGRESO"
  | "GASTO"
  | "TRANSFERENCIA"
  | "APLICACION_ACTIVO"
  | "COBRO_RENDIMIENTO"
  | "COBRO_CAPITAL"
  | "TOMA_PASIVO"
  | "PAGO_INTERES"
  | "PAGO_CAPITAL"
  | "BAJA_INCOBRABLE"
  | "AJUSTE";

export const TIPOS_CON_ACTIVO: TipoMovimiento[] = ["APLICACION_ACTIVO", "COBRO_RENDIMIENTO", "COBRO_CAPITAL", "BAJA_INCOBRABLE"];
export const TIPOS_CON_PASIVO: TipoMovimiento[] = ["TOMA_PASIVO", "PAGO_INTERES", "PAGO_CAPITAL"];

/** Signo sobre el saldo de la cuenta de origen: +1 entra plata, −1 sale. */
export const SIGNO_CUENTA: Record<TipoMovimiento, 1 | -1 | 0> = {
  INGRESO: 1,
  GASTO: -1,
  TRANSFERENCIA: -1,
  APLICACION_ACTIVO: -1,
  COBRO_RENDIMIENTO: 1,
  COBRO_CAPITAL: 1,
  TOMA_PASIVO: 1,
  PAGO_INTERES: -1,
  PAGO_CAPITAL: -1,
  BAJA_INCOBRABLE: 0,
  AJUSTE: 1, // el monto del ajuste lleva su propio signo
};

export interface MovimientoAValidar {
  tipo: TipoMovimiento;
  monto: Decimal.Value;
  moneda: "ARS" | "USD";
  cuentaId?: string | null;
  monedaCuenta?: "ARS" | "USD" | null;
  cuentaDestinoId?: string | null;
  monedaCuentaDestino?: "ARS" | "USD" | null;
  montoDestino?: Decimal.Value | null;
  categoriaId?: string | null;
  activoId?: string | null;
  pasivoId?: string | null;
}

/** Devuelve el primer problema encontrado, o null si el movimiento es válido. */
export function validarMovimiento(m: MovimientoAValidar): string | null {
  const monto = new Decimal(m.monto);
  if (m.tipo === "AJUSTE" ? monto.isZero() : monto.lte(0)) return "El monto tiene que ser mayor a cero.";

  if (m.tipo === "BAJA_INCOBRABLE") {
    if (m.cuentaId) return "Una baja por incobrable no usa cuenta.";
  } else {
    if (!m.cuentaId) return "Elegí la cuenta.";
    if (m.monedaCuenta && m.monedaCuenta !== m.moneda) return "La moneda del movimiento tiene que ser la de la cuenta.";
  }

  if (m.tipo === "TRANSFERENCIA") {
    if (!m.cuentaDestinoId) return "Elegí la cuenta de destino.";
    if (m.cuentaDestinoId === m.cuentaId) return "La cuenta de destino tiene que ser distinta.";
    if (m.monedaCuentaDestino && m.monedaCuentaDestino !== m.moneda) {
      if (!m.montoDestino || new Decimal(m.montoDestino).lte(0)) return "Indicá cuánto entra en la cuenta de destino.";
    }
  }
  if (TIPOS_CON_ACTIVO.includes(m.tipo) && !m.activoId) return "Elegí el activo.";
  if (TIPOS_CON_PASIVO.includes(m.tipo) && !m.pasivoId) return "Elegí el pasivo.";
  if ((m.tipo === "INGRESO" || m.tipo === "GASTO") && !m.categoriaId && !(m.tipo === "GASTO" && m.activoId)) {
    return "Elegí la categoría.";
  }
  return null;
}

/** TC implícito de una transferencia entre monedas (ARS por USD), solo de referencia. */
export function tcImplicito(monto: Decimal.Value, moneda: "ARS" | "USD", montoDestino: Decimal.Value): Decimal {
  const origen = new Decimal(monto);
  const destino = new Decimal(montoDestino);
  return moneda === "ARS" ? origen.div(destino) : destino.div(origen);
}
