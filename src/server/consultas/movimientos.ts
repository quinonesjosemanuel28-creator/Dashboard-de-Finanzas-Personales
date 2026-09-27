import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TipoMovimiento } from "@/domain/movimientos";
import { formatFecha, parsePeriodo, sumarMeses } from "@/domain/fechas";
import { db } from "@/server/db";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";

export interface FiltrosMovimientos {
  mes?: string;
  tipo?: string;
  cuentaId?: string;
  categoriaId?: string;
  activoId?: string;
  pasivoId?: string;
  moneda?: string;
  q?: string;
}

export async function listarMovimientos(f: FiltrosMovimientos) {
  const where: Prisma.MovimientoWhereInput = {};
  if (f.mes && /^\d{4}-\d{2}$/.test(f.mes)) {
    const { anio, mes } = parsePeriodo(f.mes);
    const sig = sumarMeses(anio, mes, 1);
    where.fecha = { gte: aFechaDb(formatFecha(anio, mes, 1)), lt: aFechaDb(formatFecha(sig.anio, sig.mes, 1)) };
  }
  if (f.tipo) where.tipo = f.tipo as TipoMovimiento;
  if (f.cuentaId) where.OR = [{ cuentaId: f.cuentaId }, { cuentaDestinoId: f.cuentaId }];
  if (f.categoriaId) where.categoriaId = f.categoriaId;
  if (f.activoId) where.activoId = f.activoId;
  if (f.pasivoId) where.pasivoId = f.pasivoId;
  if (f.moneda === "ARS" || f.moneda === "USD") where.moneda = f.moneda;
  if (f.q?.trim()) where.descripcion = { contains: f.q.trim(), mode: "insensitive" };

  const movimientos = await db.movimiento.findMany({
    where,
    include: { cuenta: true, cuentaDestino: true, categoria: true, activo: true, pasivo: true },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  return movimientos.map((m) => ({
    id: m.id,
    fecha: deFechaDb(m.fecha),
    tipo: m.tipo as TipoMovimiento,
    monto: m.monto.toString(),
    moneda: m.moneda,
    montoDestino: m.montoDestino?.toString() ?? null,
    monedaDestino: m.cuentaDestino?.moneda ?? null,
    cuenta: m.cuenta?.nombre ?? null,
    cuentaDestino: m.cuentaDestino?.nombre ?? null,
    categoria: m.categoria?.nombre ?? null,
    activo: m.activo?.nombre ?? null,
    pasivo: m.pasivo?.nombre ?? null,
    descripcion: m.descripcion,
    vinculadoACuota: m.cuotaActivoId !== null || m.cuotaPasivoId !== null,
  }));
}

export async function opcionesFiltros() {
  const [cuentas, categorias, activos, pasivos] = await Promise.all([
    db.cuenta.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, moneda: true } }),
    db.categoria.findMany({ orderBy: [{ tipo: "desc" }, { nombre: "asc" }], select: { id: true, nombre: true, tipo: true } }),
    db.activo.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.pasivo.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return { cuentas, categorias, activos, pasivos };
}

export async function obtenerMovimiento(id: string) {
  const m = await db.movimiento.findUnique({
    where: { id },
    include: {
      cuenta: true,
      cuentaDestino: true,
      categoria: true,
      activo: { include: { tipoActivo: true } },
      pasivo: true,
      cuotaActivo: true,
      cuotaPasivo: true,
    },
  });
  if (!m) return null;
  const cuota = m.cuotaPasivo ?? m.cuotaActivo;
  return {
    id: m.id,
    tipo: m.tipo as TipoMovimiento,
    fecha: deFechaDb(m.fecha),
    monto: m.monto.toString(),
    moneda: m.moneda,
    tipoCambio: m.tipoCambio.toString(),
    cuentaId: m.cuentaId,
    cuentaDestinoId: m.cuentaDestinoId,
    montoDestino: m.montoDestino?.toString() ?? null,
    categoriaId: m.categoriaId,
    descripcion: m.descripcion,
    activo: m.activo ? { id: m.activo.id, nombre: m.activo.nombre } : null,
    pasivo: m.pasivo ? { id: m.pasivo.id, nombre: m.pasivo.nombre } : null,
    cuota: cuota ? { numero: cuota.numero, fechaVencimiento: deFechaDb(cuota.fechaVencimiento) } : null,
    esDeVenta:
      m.activo?.tipoActivo.comportamiento === "COMPRAVENTA" &&
      m.activo.fechaVenta !== null &&
      m.activo.fechaVenta.getTime() === m.fecha.getTime() &&
      ["COBRO_CAPITAL", "COBRO_RENDIMIENTO", "BAJA_INCOBRABLE"].includes(m.tipo),
  };
}
