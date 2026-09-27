import type { Fecha } from "@/domain/fechas";

/** Fecha del dominio → Date para columnas `@db.Date` (medianoche UTC). */
export function aFechaDb(fecha: Fecha): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

/** Columna `@db.Date` → Fecha del dominio. */
export function deFechaDb(fecha: Date): Fecha {
  return fecha.toISOString().slice(0, 10);
}
