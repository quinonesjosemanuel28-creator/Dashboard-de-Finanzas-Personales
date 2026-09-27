import "server-only";
import type { Moneda } from "@/domain/fx";
import { db } from "@/server/db";

export async function cuentasActivas(moneda?: Moneda) {
  return db.cuenta.findMany({
    where: { archivada: false, ...(moneda ? { moneda } : {}) },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, moneda: true },
  });
}

/** Cuenta por defecto de una moneda: la última usada, o la primera por nombre. */
export async function cuentaPorDefecto(moneda: Moneda): Promise<string | null> {
  const ultimo = await db.movimiento.findFirst({
    where: { cuentaId: { not: null }, cuenta: { moneda, archivada: false } },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: { cuentaId: true },
  });
  if (ultimo?.cuentaId) return ultimo.cuentaId;
  const primera = await db.cuenta.findFirst({ where: { moneda, archivada: false }, orderBy: { nombre: "asc" } });
  return primera?.id ?? null;
}
