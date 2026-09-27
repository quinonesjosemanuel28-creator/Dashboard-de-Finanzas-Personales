/**
 * "Hoy" en la zona horaria de Argentina, como Fecha del dominio (YYYY-MM-DD).
 * Es el único punto donde se mira el reloj; el dominio recibe la fecha.
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Fecha } from "@/domain/fechas";

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export function fechaEnArgentina(instante: Date): Fecha {
  return format(new TZDate(instante, ZONA_HORARIA), "yyyy-MM-dd");
}

export function hoy(): Fecha {
  return fechaEnArgentina(new Date());
}
