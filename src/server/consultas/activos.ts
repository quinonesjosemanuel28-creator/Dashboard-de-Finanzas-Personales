import "server-only";
import { type Comportamiento, type DatosValuacion, costoCompraventa, valorActivo } from "@/domain/activos";
import { evaluarEliminacion } from "@/domain/borrado";
import { type EstadoCuota, estadoCuota } from "@/domain/cuotas";
import { CERO } from "@/domain/decimal";
import type { Moneda } from "@/domain/fx";
import { pendienteCuota } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import { db } from "@/server/db";
import { deFechaDb } from "@/server/fechas-db";

export function contarMovimientosActivo(activoId: string) {
  return db.movimiento.count({ where: { OR: [{ activoId }, { cuotaActivo: { activoId } }] } });
}

const incluirParaValor = {
  tipoActivo: true,
  cuotas: { orderBy: [{ fechaVencimiento: "asc" as const }, { numero: "asc" as const }] },
  movimientos: { select: { tipo: true, monto: true } },
};

type ActivoConValor = NonNullable<Awaited<ReturnType<typeof db.activo.findFirst<{ include: typeof incluirParaValor }>>>>;

function aDatosValuacion(a: ActivoConValor): DatosValuacion {
  return {
    comportamiento: a.tipoActivo.comportamiento as Comportamiento,
    capitalInicial: a.capitalInicial.toString(),
    capitalInicialRegistrado: a.capitalInicialRegistrado,
    movimientos: a.movimientos.map((m) => ({ tipo: m.tipo, monto: m.monto.toString() })),
    cuotas: a.cuotas.map((c) => ({ interes: c.interes.toString(), capital: c.capital.toString(), montoPagado: c.montoCobrado.toString() })),
    vendido: a.fechaVenta !== null,
    valuacionActual: a.valuacionActual?.toString() ?? null,
  };
}

export async function datosValuacion(activoId: string): Promise<DatosValuacion> {
  const a = await db.activo.findUniqueOrThrow({ where: { id: activoId }, include: incluirParaValor });
  return aDatosValuacion(a);
}

export interface CuotaActivoVista {
  id: string;
  numero: number;
  fechaVencimiento: string;
  mesesCubiertos: number;
  interes: string;
  capital: string;
  montoPagado: string;
  pendiente: string;
  estado: EstadoCuota;
  cobrosRegistrados: number;
}

export async function listarActivos(incluirArchivados: boolean) {
  const fechaHoy = hoy();
  const activos = await db.activo.findMany({
    where: incluirArchivados ? {} : { estado: { not: "ARCHIVADO" } },
    include: { ...incluirParaValor, contraparte: true },
    orderBy: [{ nombre: "asc" }],
  });
  return activos.map((a) => {
    const proxima = a.cuotas
      .map((c) => {
        const datos = { interes: c.interes.toString(), capital: c.capital.toString(), montoPagado: c.montoCobrado.toString(), fechaVencimiento: deFechaDb(c.fechaVencimiento) };
        return { ...datos, pendiente: pendienteCuota(datos).toString(), estado: estadoCuota(datos, fechaHoy) };
      })
      .find((c) => c.estado !== "PAGADA");
    return {
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipoActivo.nombre,
      tipoId: a.tipoActivoId,
      comportamiento: a.tipoActivo.comportamiento as Comportamiento,
      contraparte: a.contraparte?.nombre ?? null,
      moneda: a.moneda as Moneda,
      valor: valorActivo(aDatosValuacion(a)).toString(),
      estado: a.estado,
      tasaMensual: a.tasaMensual?.toString() ?? null,
      rendimientoEsperadoMensual: a.rendimientoEsperadoMensual?.toString() ?? null,
      fechaValuacion: a.fechaValuacion ? deFechaDb(a.fechaValuacion) : null,
      vendido: a.fechaVenta !== null,
      proxima: proxima ?? null,
      vencidas: a.cuotas.filter(
        (c) => estadoCuota({ interes: c.interes.toString(), capital: c.capital.toString(), montoPagado: c.montoCobrado.toString(), fechaVencimiento: deFechaDb(c.fechaVencimiento) }, fechaHoy) === "VENCIDA",
      ).length,
    };
  });
}

export async function obtenerActivo(id: string) {
  const fechaHoy = hoy();
  const a = await db.activo.findUnique({
    where: { id },
    include: {
      ...incluirParaValor,
      contraparte: true,
      cuotas: {
        orderBy: [{ fechaVencimiento: "asc" }, { numero: "asc" }],
        include: { _count: { select: { movimientos: true } } },
      },
      registrosCartera: { orderBy: { periodo: "desc" }, take: 12 },
      valuaciones: { orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 12 },
      _count: { select: { fondeos: true } },
    },
  });
  if (!a) return null;
  const [movimientos, cantidadMovimientos] = await Promise.all([
    db.movimiento.findMany({
      where: { activoId: id },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { cuenta: true },
    }),
    contarMovimientosActivo(id),
  ]);
  const datos = aDatosValuacion(a);
  const comportamiento = a.tipoActivo.comportamiento as Comportamiento;
  const sumaTipo = (tipo: string) => datos.movimientos.filter((m) => m.tipo === tipo).reduce((s, m) => s.add(m.monto), CERO);

  const cuotas: CuotaActivoVista[] = a.cuotas.map((c) => {
    const d = { interes: c.interes.toString(), capital: c.capital.toString(), montoPagado: c.montoCobrado.toString(), fechaVencimiento: deFechaDb(c.fechaVencimiento) };
    return {
      id: c.id,
      numero: c.numero,
      fechaVencimiento: d.fechaVencimiento,
      mesesCubiertos: c.mesesCubiertos,
      interes: d.interes,
      capital: d.capital,
      montoPagado: d.montoPagado,
      pendiente: pendienteCuota(d).toString(),
      estado: estadoCuota(d, fechaHoy),
      cobrosRegistrados: c._count.movimientos,
    };
  });

  return {
    id: a.id,
    nombre: a.nombre,
    tipo: a.tipoActivo.nombre,
    comportamiento,
    contraparte: a.contraparte?.nombre ?? null,
    moneda: a.moneda as Moneda,
    estado: a.estado,
    capitalInicial: a.capitalInicial.toString(),
    fechaInicio: deFechaDb(a.fechaInicio),
    fechaFin: a.fechaFin ? deFechaDb(a.fechaFin) : null,
    tasaMensual: a.tasaMensual?.toString() ?? null,
    esquema: a.esquema,
    frecuenciaPago: a.frecuenciaPago,
    diaPago: a.diaPago,
    plazoMeses: a.plazoMeses,
    rendimientoEsperadoMensual: a.rendimientoEsperadoMensual?.toString() ?? null,
    valuacionActual: a.valuacionActual?.toString() ?? null,
    fechaValuacion: a.fechaValuacion ? deFechaDb(a.fechaValuacion) : null,
    precioVenta: a.precioVenta?.toString() ?? null,
    fechaVenta: a.fechaVenta ? deFechaDb(a.fechaVenta) : null,
    notas: a.notas,
    valor: valorActivo(datos).toString(),
    costo: comportamiento === "COMPRAVENTA" ? costoCompraventa(datos).toString() : null,
    rendimientoCobrado: sumaTipo("COBRO_RENDIMIENTO").toString(),
    gastosDirectos: sumaTipo("GASTO").toString(),
    cuotas,
    registrosCartera: a.registrosCartera.map((r) => ({
      id: r.id,
      periodo: r.periodo,
      capitalEnCalle: r.capitalEnCalle.toString(),
      capitalEnMora: r.capitalEnMora.toString(),
      clientesActivos: r.clientesActivos,
    })),
    valuaciones: a.valuaciones.map((v) => ({ id: v.id, fecha: deFechaDb(v.fecha), valor: v.valor.toString() })),
    movimientos: movimientos.map((m) => ({
      id: m.id,
      fecha: deFechaDb(m.fecha),
      tipo: m.tipo,
      monto: m.monto.toString(),
      cuenta: m.cuenta?.nombre ?? null,
      descripcion: m.descripcion,
    })),
    eliminacion: evaluarEliminacion({ movimientos: cantidadMovimientos, fondeos: a._count.fondeos }),
  };
}

export type ActivoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerActivo>>>;
