/**
 * Cronogramas de pasivos (mutuos) y de activos RENTA_PROGRAMADA. SPEC §5.2 y §5.3.
 *
 * - Pago por aniversario: la cuota se paga el `diaPago` de cada mes, sin mover
 *   por feriados ni fines de semana. Si el mes no tiene ese día, se usa el
 *   último día del mes.
 * - La rentabilidad se paga cada N meses (`frecuenciaPago`), con interés simple:
 *   interés de la cuota = capital × tasaMensual × meses que cubre.
 * - Devengado (ER): cada cuota reparte su interés en partes iguales entre los
 *   meses de los aniversarios mensuales que cubre.
 */

import { CERO, Decimal, redondear2 } from "./decimal";
import {
  type Fecha,
  type Periodo,
  compararFechas,
  diasDelMes,
  formatFecha,
  formatPeriodo,
  parseFecha,
  parsePeriodo,
  periodoDe,
  sumarMeses,
  sumarMesesPeriodo,
} from "./fechas";

export type FrecuenciaPago = "MENSUAL" | "TRIMESTRAL" | "CUATRIMESTRAL" | "SEMESTRAL" | "ANUAL";

export type EsquemaCronograma =
  | "INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO"
  | "CUOTAS_IGUALES_INTERES_DIRECTO";

export const MESES_POR_FRECUENCIA: Record<FrecuenciaPago, number> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  CUATRIMESTRAL: 4,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export interface ParametrosCronograma {
  capital: Decimal.Value;
  tasaMensual: Decimal.Value;
  esquema: EsquemaCronograma;
  fechaInicio: Fecha;
  /** Fecha de vencimiento tal como figura en el contrato. */
  fechaVencimiento: Fecha;
  plazoMeses: number;
  /** Día de pago (1–31). Por defecto, el día de `fechaInicio`. */
  diaPago: number;
  frecuenciaPago: FrecuenciaPago;
}

export interface CuotaPropuesta {
  numero: number;
  fechaVencimiento: Fecha;
  /** Primer mes que devenga esta cuota. */
  periodoDesde: Periodo;
  /** Meses de interés que cubre; 0 = cuota solo de capital. */
  mesesCubiertos: number;
  interes: Decimal;
  capital: Decimal;
}

/** Día de pago por defecto: el día del mes de la fecha de inicio. */
export function diaPagoPorDefecto(fechaInicio: Fecha): number {
  return parseFecha(fechaInicio).dia;
}

/** Fecha de pago en un mes dado: `diaPago`, o el último día si el mes es más corto. */
export function fechaDePagoEnPeriodo(periodo: Periodo, diaPago: number): Fecha {
  validarDiaPago(diaPago);
  const { anio, mes } = parsePeriodo(periodo);
  return formatFecha(anio, mes, Math.min(diaPago, diasDelMes(anio, mes)));
}

/** Aniversario mensual número `k` (k ≥ 1) contado desde `fechaInicio`. */
export function fechaAniversario(fechaInicio: Fecha, diaPago: number, k: number): Fecha {
  const { anio, mes } = parseFecha(fechaInicio);
  const r = sumarMeses(anio, mes, k);
  return fechaDePagoEnPeriodo(formatPeriodo(r.anio, r.mes), diaPago);
}

/** Vencimiento sugerido para el alta: el aniversario número `plazoMeses`. */
export function fechaVencimientoSugerida(fechaInicio: Fecha, diaPago: number, plazoMeses: number): Fecha {
  return fechaAniversario(fechaInicio, diaPago, plazoMeses);
}

/**
 * Genera el cronograma propuesto. Es una propuesta: la UI la muestra en vista
 * previa y cada cuota se puede editar antes de guardar.
 *
 * - Cuotas de interés cada N meses en la fecha aniversario; si el plazo no es
 *   múltiplo de N, la última cubre los meses restantes. La última cuota de
 *   interés se paga siempre en `fechaVencimiento`.
 * - INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO: el capital va en una cuota aparte
 *   (interés 0) en `fechaVencimiento`.
 * - CUOTAS_IGUALES_INTERES_DIRECTO: cada cuota amortiza capital en proporción a
 *   los meses que cubre; la última absorbe el redondeo.
 */
export function generarCronograma(p: ParametrosCronograma): CuotaPropuesta[] {
  const capital = new Decimal(p.capital);
  const tasa = new Decimal(p.tasaMensual);
  if (capital.lte(0)) throw new Error("El capital tiene que ser mayor a cero");
  if (tasa.isNeg()) throw new Error("La tasa no puede ser negativa");
  if (!Number.isInteger(p.plazoMeses) || p.plazoMeses < 1) {
    throw new Error("El plazo tiene que ser un número entero de meses mayor a cero");
  }
  validarDiaPago(p.diaPago);
  parseFecha(p.fechaInicio);
  parseFecha(p.fechaVencimiento);

  const n = MESES_POR_FRECUENCIA[p.frecuenciaPago];
  const cantidad = Math.ceil(p.plazoMeses / n);

  const tramos = Array.from({ length: cantidad }, (_, i) => {
    const desde = i * n + 1; // primer aniversario mensual que cubre
    const meses = Math.min(n, p.plazoMeses - i * n);
    const esUltima = i === cantidad - 1;
    return {
      meses,
      periodoDesde: periodoDe(fechaAniversario(p.fechaInicio, p.diaPago, desde)),
      fecha: esUltima
        ? p.fechaVencimiento
        : fechaAniversario(p.fechaInicio, p.diaPago, desde + meses - 1),
    };
  });

  const anterior = tramos.length > 1 ? tramos[tramos.length - 2]!.fecha : p.fechaInicio;
  if (compararFechas(p.fechaVencimiento, anterior) <= 0) {
    throw new Error("La fecha de vencimiento tiene que ser posterior a la cuota anterior");
  }

  const interesMensual = capital.mul(tasa);

  if (p.esquema === "INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO") {
    const cuotas: CuotaPropuesta[] = tramos.map((t, i) => ({
      numero: i + 1,
      fechaVencimiento: t.fecha,
      periodoDesde: t.periodoDesde,
      mesesCubiertos: t.meses,
      interes: redondear2(interesMensual.mul(t.meses)),
      capital: CERO,
    }));
    cuotas.push({
      numero: cuotas.length + 1,
      fechaVencimiento: p.fechaVencimiento,
      periodoDesde: periodoDe(p.fechaVencimiento),
      mesesCubiertos: 0,
      interes: CERO,
      capital: redondear2(capital),
    });
    return cuotas;
  }

  // CUOTAS_IGUALES_INTERES_DIRECTO
  const interesTotal = redondear2(interesMensual.mul(p.plazoMeses));
  const capitalTotal = redondear2(capital);
  let interesAcum = CERO;
  let capitalAcum = CERO;
  return tramos.map((t, i) => {
    const esUltima = i === tramos.length - 1;
    const interes = esUltima ? interesTotal.sub(interesAcum) : redondear2(interesMensual.mul(t.meses));
    const cap = esUltima
      ? capitalTotal.sub(capitalAcum)
      : redondear2(capital.mul(t.meses).div(p.plazoMeses));
    interesAcum = interesAcum.add(interes);
    capitalAcum = capitalAcum.add(cap);
    return {
      numero: i + 1,
      fechaVencimiento: t.fecha,
      periodoDesde: t.periodoDesde,
      mesesCubiertos: t.meses,
      interes,
      capital: cap,
    };
  });
}

// ---------------------------------------------------------------------------
// Devengado

export interface CuotaDevengable {
  interes: Decimal.Value;
  periodoDesde: Periodo;
  mesesCubiertos: number;
}

export interface PorcionDevengada {
  periodo: Periodo;
  interes: Decimal;
}

/**
 * Reparte el interés de una cuota en partes iguales entre los meses que cubre.
 * La última parte absorbe el redondeo, así la suma es exactamente el interés
 * de la cuota (también si se editó a mano).
 */
export function distribuirDevengado(cuota: CuotaDevengable): PorcionDevengada[] {
  const meses = cuota.mesesCubiertos;
  if (meses <= 0) return [];
  const total = new Decimal(cuota.interes);
  const parte = redondear2(total.div(meses));
  return Array.from({ length: meses }, (_, i) => ({
    periodo: sumarMesesPeriodo(cuota.periodoDesde, i),
    interes: i === meses - 1 ? total.sub(parte.mul(meses - 1)) : parte,
  }));
}

/** Interés devengado en un período (mes) por un conjunto de cuotas. Base del ER. */
export function devengadoDelPeriodo(cuotas: CuotaDevengable[], periodo: Periodo): Decimal {
  let total = CERO;
  for (const c of cuotas) {
    for (const porcion of distribuirDevengado(c)) {
      if (porcion.periodo === periodo) total = total.add(porcion.interes);
    }
  }
  return total;
}

export interface CuotaConPago extends CuotaDevengable {
  montoPagado: Decimal.Value;
}

/**
 * Interés devengado y no pagado a una fecha de corte (Balance: "Intereses
 * devengados impagos"). Cada porción mensual devenga en la fecha de pago de
 * su mes. Lo pagado de una cuota se aplica primero al interés.
 */
export function interesDevengadoImpago(
  cuotas: CuotaConPago[],
  diaPago: number,
  fechaCorte: Fecha,
): Decimal {
  let total = CERO;
  for (const c of cuotas) {
    let devengado = CERO;
    for (const porcion of distribuirDevengado(c)) {
      if (compararFechas(fechaDePagoEnPeriodo(porcion.periodo, diaPago), fechaCorte) <= 0) {
        devengado = devengado.add(porcion.interes);
      }
    }
    const interesPagado = Decimal.min(new Decimal(c.montoPagado), new Decimal(c.interes));
    const impago = devengado.sub(interesPagado);
    if (impago.gt(0)) total = total.add(impago);
  }
  return total;
}

// ---------------------------------------------------------------------------

function validarDiaPago(diaPago: number): void {
  if (!Number.isInteger(diaPago) || diaPago < 1 || diaPago > 31) {
    throw new Error("El día de pago tiene que estar entre 1 y 31");
  }
}
