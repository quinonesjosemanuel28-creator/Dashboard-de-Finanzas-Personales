import "server-only";
import { Decimal } from "@/domain/decimal";
import { formatFecha, parseFecha, sumarMeses } from "@/domain/fechas";
import type { Moneda } from "@/domain/fx";
import { pendienteCuota } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import { cuentaPorDefecto } from "@/server/consultas/cuentas";
import { db } from "@/server/db";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";

export interface CuotaSugerida {
  id: string;
  lado: "activo" | "pasivo";
  padreId: string;
  nombre: string;
  numero: number;
  fechaVencimiento: string;
  pendiente: string;
  moneda: Moneda;
}

/** Todo lo que necesita la carga rápida, en una sola consulta desde la página. */
export async function datosCargaRapida() {
  const fechaHoy = hoy();
  const { anio, mes, dia } = parseFecha(fechaHoy);
  const hace90 = sumarMeses(anio, mes, -3);
  const en30 = sumarMeses(anio, mes, 1);
  const limite = aFechaDb(formatFecha(en30.anio, en30.mes, Math.min(dia, 28)));

  const [cuentas, categorias, usos, cuotasPasivo, cuotasActivo, pasivos, activos, defARS, defUSD] = await Promise.all([
    db.cuenta.findMany({ where: { archivada: false }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, moneda: true } }),
    db.categoria.findMany({ where: { archivada: false }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, tipo: true } }),
    db.movimiento.groupBy({
      by: ["categoriaId"],
      where: { categoriaId: { not: null }, fecha: { gte: aFechaDb(formatFecha(hace90.anio, hace90.mes, 1)) } },
      _count: { _all: true },
    }),
    db.cuotaPasivo.findMany({
      where: { estado: { not: "PAGADA" }, fechaVencimiento: { lte: limite }, pasivo: { estado: { in: ["VIGENTE", "EN_PREAVISO"] } } },
      include: { pasivo: { include: { contraparte: true } } },
      orderBy: { fechaVencimiento: "asc" },
      take: 12,
    }),
    db.cuotaActivo.findMany({
      where: { estado: { not: "PAGADA" }, fechaVencimiento: { lte: limite }, activo: { estado: { in: ["ACTIVO", "EN_MORA"] } } },
      include: { activo: true },
      orderBy: { fechaVencimiento: "asc" },
      take: 12,
    }),
    db.pasivo.findMany({ where: { estado: { in: ["VIGENTE", "EN_PREAVISO"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, moneda: true } }),
    db.activo.findMany({
      where: { estado: { in: ["ACTIVO", "EN_MORA"] } },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, moneda: true, tipoActivo: { select: { comportamiento: true } } },
    }),
    cuentaPorDefecto("ARS"),
    cuentaPorDefecto("USD"),
  ]);

  const usoPorCategoria = new Map(usos.map((u) => [u.categoriaId, u._count._all]));
  const aSugerida = (
    lado: "activo" | "pasivo",
    c: { id: string; numero: number; fechaVencimiento: Date; interes: Decimal.Value | { toString(): string }; capital: { toString(): string } },
    montoPagado: string,
    padre: { id: string; nombre: string; moneda: string },
  ): CuotaSugerida => ({
    id: c.id,
    lado,
    padreId: padre.id,
    nombre: padre.nombre,
    numero: c.numero,
    fechaVencimiento: deFechaDb(c.fechaVencimiento),
    pendiente: pendienteCuota({ interes: c.interes.toString(), capital: c.capital.toString(), montoPagado, fechaVencimiento: deFechaDb(c.fechaVencimiento) }).toString(),
    moneda: padre.moneda as Moneda,
  });

  return {
    hoy: fechaHoy,
    cuentas: cuentas.map((c) => ({ ...c, moneda: c.moneda as Moneda })),
    cuentaPorDefecto: { ARS: defARS, USD: defUSD },
    categorias: categorias
      .map((c) => ({ ...c, usos: usoPorCategoria.get(c.id) ?? 0 }))
      .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, "es")),
    cuotasPasivo: cuotasPasivo.map((c) =>
      aSugerida("pasivo", c, c.montoPagado.toString(), { id: c.pasivoId, nombre: c.pasivo.contraparte?.nombre ?? c.pasivo.nombre, moneda: c.pasivo.moneda }),
    ),
    cuotasActivo: cuotasActivo.map((c) => aSugerida("activo", c, c.montoCobrado.toString(), { id: c.activoId, nombre: c.activo.nombre, moneda: c.activo.moneda })),
    pasivos: pasivos.map((p) => ({ ...p, moneda: p.moneda as Moneda })),
    activos: activos.map((a) => ({ id: a.id, nombre: a.nombre, moneda: a.moneda as Moneda, comportamiento: a.tipoActivo.comportamiento })),
  };
}

export type DatosCargaRapida = Awaited<ReturnType<typeof datosCargaRapida>>;
