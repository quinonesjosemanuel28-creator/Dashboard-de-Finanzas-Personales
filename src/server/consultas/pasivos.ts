import "server-only";
import { type EstadoCuota, estadoCuota, punitorioEstimado } from "@/domain/cuotas";
import { Decimal } from "@/domain/decimal";
import type { Moneda } from "@/domain/fx";
import { evaluarEliminacion } from "@/domain/borrado";
import { capitalPendiente, pendienteCuota } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import { db } from "@/server/db";
import { deFechaDb } from "@/server/fechas-db";

/** Cuota lista para la UI (montos como string decimal). */
export interface CuotaVista {
  id: string;
  numero: number;
  fechaVencimiento: string;
  periodoDesde: string;
  mesesCubiertos: number;
  interes: string;
  capital: string;
  montoPagado: string;
  pendiente: string;
  estado: EstadoCuota;
  punitorio: string | null;
  fechaPago: string | null;
}

type CuotaDb = {
  id: string;
  numero: number;
  fechaVencimiento: Date;
  periodoDesde: string;
  mesesCubiertos: number;
  interes: { toString(): string };
  capital: { toString(): string };
  montoPagado: { toString(): string };
  fechaPago: Date | null;
};

function aVista(c: CuotaDb, punitorioMensual: string | null, fechaHoy: string): CuotaVista {
  const datos = {
    interes: c.interes.toString(),
    capital: c.capital.toString(),
    montoPagado: c.montoPagado.toString(),
    fechaVencimiento: deFechaDb(c.fechaVencimiento),
  };
  const estado = estadoCuota(datos, fechaHoy);
  return {
    id: c.id,
    numero: c.numero,
    fechaVencimiento: datos.fechaVencimiento,
    periodoDesde: c.periodoDesde,
    mesesCubiertos: c.mesesCubiertos,
    interes: datos.interes,
    capital: datos.capital,
    montoPagado: datos.montoPagado,
    pendiente: pendienteCuota(datos).toString(),
    estado,
    punitorio:
      estado === "VENCIDA" && punitorioMensual ? punitorioEstimado(datos, punitorioMensual, fechaHoy).toString() : null,
    fechaPago: c.fechaPago ? deFechaDb(c.fechaPago) : null,
  };
}

export async function listarPasivos(incluirArchivados: boolean) {
  const fechaHoy = hoy();
  const pasivos = await db.pasivo.findMany({
    where: incluirArchivados ? {} : { estado: { not: "ARCHIVADO" } },
    include: { contraparte: true, cuotas: { orderBy: { fechaVencimiento: "asc" } } },
    orderBy: [{ estado: "asc" }, { fechaVencimiento: "asc" }],
  });
  return pasivos.map((p) => {
    const cuotas = p.cuotas.map((c) => aVista(c, p.punitorioMensual?.toString() ?? null, fechaHoy));
    const proxima = cuotas.find((c) => c.estado !== "PAGADA") ?? null;
    return {
      id: p.id,
      nombre: p.nombre,
      inversor: p.contraparte?.nombre ?? null,
      moneda: p.moneda as Moneda,
      capital: p.capital.toString(),
      capitalPendiente: capitalPendiente(p.capital.toString(), cuotas).toString(),
      tasaMensual: p.tasaMensual.toString(),
      frecuenciaPago: p.frecuenciaPago,
      estado: p.estado,
      instrumentacion: p.instrumentacion,
      vencidas: cuotas.filter((c) => c.estado === "VENCIDA").length,
      proxima,
    };
  });
}

/** Movimientos vinculados al pasivo, directo o a través de sus cuotas. */
export function contarMovimientosPasivo(pasivoId: string) {
  return db.movimiento.count({ where: { OR: [{ pasivoId }, { cuotaPasivo: { pasivoId } }] } });
}

export async function obtenerPasivo(id: string) {
  const fechaHoy = hoy();
  const p = await db.pasivo.findUnique({
    where: { id },
    include: {
      contraparte: true,
      cuotas: {
        orderBy: [{ fechaVencimiento: "asc" }, { numero: "asc" }],
        include: { _count: { select: { movimientos: true } } },
      },
      movimientos: { orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 20, include: { cuenta: true } },
      _count: { select: { fondeos: true } },
    },
  });
  if (!p) return null;
  const movimientosVinculados = await contarMovimientosPasivo(id);
  const cuotas = p.cuotas.map((c) => ({
    ...aVista(c, p.punitorioMensual?.toString() ?? null, fechaHoy),
    /** Movimientos de pago registrados en la app (0 si se marcó con "pagadas hasta"). */
    pagosRegistrados: c._count.movimientos,
  }));
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    inversor: p.contraparte?.nombre ?? null,
    moneda: p.moneda as Moneda,
    capital: p.capital.toString(),
    capitalPendiente: capitalPendiente(p.capital.toString(), cuotas).toString(),
    tasaMensual: p.tasaMensual.toString(),
    esquema: p.esquema,
    frecuenciaPago: p.frecuenciaPago,
    diaPago: p.diaPago,
    fechaInicio: deFechaDb(p.fechaInicio),
    fechaVencimiento: deFechaDb(p.fechaVencimiento),
    plazoMeses: p.plazoMeses,
    instrumentacion: p.instrumentacion,
    regularizacion: p.regularizacion,
    preavisoDias: p.preavisoDias,
    penalidadRetiroPct: p.penalidadRetiroPct?.toString() ?? null,
    punitorioMensual: p.punitorioMensual?.toString() ?? null,
    estado: p.estado,
    notas: p.notas,
    eliminacion: evaluarEliminacion({ movimientos: movimientosVinculados, fondeos: p._count.fondeos }),
    cuotas,
    movimientos: p.movimientos.map((m) => ({
      id: m.id,
      fecha: deFechaDb(m.fecha),
      tipo: m.tipo,
      monto: m.monto.toString(),
      cuenta: m.cuenta?.nombre ?? null,
    })),
  };
}

export type PasivoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerPasivo>>>;

/** Cuotas impagas de pasivos no archivados, hasta `hasta` (incluye vencidas anteriores). */
export async function vencimientosPasivos(hasta: string) {
  const fechaHoy = hoy();
  const cuotas = await db.cuotaPasivo.findMany({
    where: {
      estado: { not: "PAGADA" },
      fechaVencimiento: { lte: new Date(`${hasta}T00:00:00.000Z`) },
      pasivo: { estado: { notIn: ["ARCHIVADO", "CANCELADO"] } },
    },
    include: { pasivo: { include: { contraparte: true } } },
    orderBy: [{ fechaVencimiento: "asc" }, { numero: "asc" }],
  });
  return cuotas
    .map((c) => ({
      ...aVista(c, c.pasivo.punitorioMensual?.toString() ?? null, fechaHoy),
      pasivoId: c.pasivoId,
      pasivo: c.pasivo.nombre,
      inversor: c.pasivo.contraparte?.nombre ?? null,
      moneda: c.pasivo.moneda as Moneda,
    }))
    .filter((c) => new Decimal(c.pendiente).gt(0));
}
