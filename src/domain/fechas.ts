/**
 * Fechas de calendario sin hora ni zona horaria.
 *
 * El dominio trabaja con strings "YYYY-MM-DD" (Fecha) y "YYYY-MM" (Periodo)
 * para evitar los corrimientos de día de `Date` con zonas horarias. La
 * conversión desde/hacia `Date` (columnas `@db.Date`) se hace en el borde,
 * fuera de `src/domain/`.
 */

export type Fecha = string;
export type Periodo = string;

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_PERIODO = /^(\d{4})-(\d{2})$/;

export interface PartesFecha {
  anio: number;
  mes: number; // 1–12
  dia: number; // 1–31
}

const dos = (n: number) => String(n).padStart(2, "0");

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function parseFecha(fecha: Fecha): PartesFecha {
  const m = RE_FECHA.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    throw new Error(`Fecha inválida: ${fecha}`);
  }
  return { anio, mes, dia };
}

export function formatFecha(anio: number, mes: number, dia: number): Fecha {
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

export function parsePeriodo(periodo: Periodo): { anio: number; mes: number } {
  const m = RE_PERIODO.exec(periodo);
  if (!m) throw new Error(`Período inválido: ${periodo}`);
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) throw new Error(`Período inválido: ${periodo}`);
  return { anio, mes };
}

export function formatPeriodo(anio: number, mes: number): Periodo {
  return `${anio}-${dos(mes)}`;
}

export function periodoDe(fecha: Fecha): Periodo {
  const { anio, mes } = parseFecha(fecha);
  return formatPeriodo(anio, mes);
}

/** Suma `n` meses (puede ser negativo) a un año/mes. */
export function sumarMeses(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function sumarMesesPeriodo(periodo: Periodo, n: number): Periodo {
  const { anio, mes } = parsePeriodo(periodo);
  const r = sumarMeses(anio, mes, n);
  return formatPeriodo(r.anio, r.mes);
}

function aDiaUTC(fecha: Fecha): number {
  const { anio, mes, dia } = parseFecha(fecha);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

/** Días corridos de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: Fecha, hasta: Fecha): number {
  return aDiaUTC(hasta) - aDiaUTC(desde);
}

/** Las fechas "YYYY-MM-DD" se comparan bien como strings. */
export function compararFechas(a: Fecha, b: Fecha): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Día de la semana: 0 = domingo … 6 = sábado. */
export function diaDeSemana(fecha: Fecha): number {
  const { anio, mes, dia } = parseFecha(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}
