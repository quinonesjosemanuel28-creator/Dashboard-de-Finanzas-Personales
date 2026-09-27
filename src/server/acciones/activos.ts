"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { costoCompraventa, liquidarVenta, valorActivo } from "@/domain/activos";
import { evaluarEliminacion } from "@/domain/borrado";
import { CERO, Decimal } from "@/domain/decimal";
import { deshacerPagos, marcarPagadasHasta } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import { contarMovimientosActivo, datosValuacion } from "@/server/consultas/activos";
import { db } from "@/server/db";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";
import {
  OPCIONES_TX,
  actualizarEstadoActivo,
  crearMovimiento,
  mensajeDeError,
  registrarPagoCuota,
  tcObligatorio,
} from "@/server/movimientos";
import { requireSession } from "@/server/sesion";
import {
  type ResultadoAccion,
  falloValidacion,
  zDecimal,
  zFecha,
  zMonto,
  zMontoPositivo,
  zPeriodo,
} from "@/server/validacion";

const zNoNegativo = zDecimal.refine((v) => !new Decimal(v).isNeg(), "No puede ser negativo");
/** Campo vacío o ausente del formulario → null. */
const vacioANull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

// ---------------------------------------------------------------- Alta

const esquemaCuota = z.object({
  numero: z.number().int().min(1),
  fechaVencimiento: zFecha,
  periodoDesde: zPeriodo,
  mesesCubiertos: z.number().int().min(0),
  interes: zNoNegativo,
  capital: zNoNegativo,
});

const esquemaAlta = z.object({
  tipoActivoId: z.string().min(1, "Elegí el tipo de activo"),
  nombre: z.string().trim().min(1, "Poné un nombre").max(80),
  contraparteId: z.string().nullable(),
  contraparteNueva: z.string().trim().max(80).nullable(),
  moneda: z.enum(["ARS", "USD"]),
  capitalInicial: zDecimal.refine((v) => new Decimal(v).gt(0), "El capital tiene que ser mayor a cero"),
  fechaInicio: zFecha,
  notas: z.string().trim().max(500).nullable(),
  salidaCuentaId: z.string().nullable(),
  // RENTA_PROGRAMADA
  renta: z
    .object({
      tasaMensual: zNoNegativo,
      esquema: z.enum(["INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO", "CUOTAS_IGUALES_INTERES_DIRECTO"]),
      plazoMeses: z.number().int().min(1).max(600),
      diaPago: z.number().int().min(1).max(31),
      frecuenciaPago: z.enum(["MENSUAL", "TRIMESTRAL", "CUATRIMESTRAL", "SEMESTRAL", "ANUAL"]),
      fechaFin: zFecha,
      cuotas: z.array(esquemaCuota).min(1),
      cobradasHasta: zPeriodo.nullable(),
    })
    .nullable(),
  // CARTERA / COMPRAVENTA
  rendimientoEsperadoMensual: zNoNegativo.nullable(),
  // TENENCIA
  valuacionActual: zNoNegativo.nullable(),
});

export type AltaActivo = z.input<typeof esquemaAlta>;

export async function crearActivo(payload: AltaActivo): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaAlta.safeParse(payload);
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;

  const tipo = await db.tipoActivo.findUnique({ where: { id: d.tipoActivoId } });
  if (!tipo || tipo.archivado) return { ok: false, error: "El tipo de activo no existe." };
  const comp = tipo.comportamiento;
  if (comp === "RENTA_PROGRAMADA") {
    if (!d.renta) return { ok: false, error: "Faltan las condiciones del cronograma." };
    if (d.renta.fechaFin <= d.fechaInicio) return { ok: false, error: "El vencimiento tiene que ser posterior al inicio." };
    const capitalCuotas = d.renta.cuotas.reduce((s, c) => s.add(c.capital), CERO);
    if (!capitalCuotas.eq(d.capitalInicial)) return { ok: false, error: "Las cuotas tienen que devolver todo el capital. Revisá el cronograma." };
  }

  const fechaHoy = hoy();
  const cuotas = d.renta
    ? marcarPagadasHasta(d.renta.cuotas.map((c) => ({ ...c, montoPagado: "0" })), d.renta.cobradasHasta, fechaHoy)
    : [];

  try {
    const tc = d.salidaCuentaId ? await tcObligatorio(d.fechaInicio) : null;
    const activo = await db.$transaction(async (tx) => {
      const contraparteId =
        d.contraparteId ?? (d.contraparteNueva ? (await tx.contraparte.create({ data: { nombre: d.contraparteNueva, tipo: "DEUDOR" } })).id : null);
      const creado = await tx.activo.create({
        data: {
          nombre: d.nombre,
          tipoActivoId: tipo.id,
          contraparteId,
          moneda: d.moneda,
          capitalInicial: d.capitalInicial,
          capitalInicialRegistrado: !!d.salidaCuentaId,
          fechaInicio: aFechaDb(d.fechaInicio),
          notas: d.notas,
          ...(d.renta
            ? {
                tasaMensual: d.renta.tasaMensual,
                esquema: d.renta.esquema,
                plazoMeses: d.renta.plazoMeses,
                diaPago: d.renta.diaPago,
                frecuenciaPago: d.renta.frecuenciaPago,
                fechaFin: aFechaDb(d.renta.fechaFin),
              }
            : {}),
          rendimientoEsperadoMensual: comp === "CARTERA" || comp === "COMPRAVENTA" ? d.rendimientoEsperadoMensual : null,
          valuacionActual: comp === "TENENCIA" ? d.valuacionActual : null,
          fechaValuacion: comp === "TENENCIA" && d.valuacionActual ? aFechaDb(fechaHoy) : null,
          cuotas: {
            create: cuotas.map((c) => ({
              numero: c.numero,
              fechaVencimiento: aFechaDb(c.fechaVencimiento),
              periodoDesde: c.periodoDesde,
              mesesCubiertos: c.mesesCubiertos,
              interes: c.interes,
              capital: c.capital,
              estado: c.estado,
              montoCobrado: c.montoPagado.toFixed(2),
              fechaCobro: c.fechaPago ? aFechaDb(c.fechaPago) : null,
            })),
          },
          valuaciones:
            comp === "TENENCIA" && d.valuacionActual ? { create: { fecha: aFechaDb(fechaHoy), valor: d.valuacionActual } } : undefined,
        },
      });
      if (d.salidaCuentaId && tc) {
        await crearMovimiento(
          tx,
          { tipo: "APLICACION_ACTIVO", fecha: d.fechaInicio, monto: d.capitalInicial, cuentaId: d.salidaCuentaId, activoId: creado.id, descripcion: `Capital inicial · ${d.nombre}` },
          tc,
        );
      }
      if (cuotas.length > 0 && cuotas.every((c) => c.estado === "PAGADA")) {
        await tx.activo.update({ where: { id: creado.id }, data: { estado: "CERRADO" } });
      }
      return creado;
    }, OPCIONES_TX);
    revalidatePath("/activos");
    return { ok: true, id: activo.id };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo crear el activo.") };
  }
}

// ---------------------------------------------------------------- Cuotas

const esquemaCobro = z.object({
  cuotaId: z.string().min(1),
  cuentaId: z.string().min(1, "Elegí la cuenta"),
  monto: zMontoPositivo,
  fecha: zFecha,
});

export async function cobrarCuota(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaCobro.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { cuotaId, cuentaId, monto, fecha } = r.data;
  const cuota = await db.cuotaActivo.findUnique({ where: { id: cuotaId }, include: { activo: true } });
  if (!cuota) return { ok: false, error: "La cuota no existe." };
  if (cuota.activo.estado === "ARCHIVADO" || cuota.activo.estado === "INCOBRABLE") {
    return { ok: false, error: "El activo está archivado o dado de baja." };
  }
  try {
    const tc = await tcObligatorio(fecha);
    const res = await db.$transaction((tx) => registrarPagoCuota(tx, "activo", cuotaId, monto, cuentaId, fecha, tc), OPCIONES_TX);
    revalidatePath(`/activos/${cuota.activoId}`);
    revalidatePath("/activos");
    return { ok: true, mensaje: res.estado === "PAGADA" ? "Cuota cobrada." : "Cobro parcial registrado." };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo registrar el cobro.") };
  }
}

/** Borra los movimientos de cobro de la cuota y la vuelve a su estado según hoy. */
export async function deshacerCobro(cuotaId: string): Promise<ResultadoAccion> {
  await requireSession();
  const cuota = await db.cuotaActivo.findUnique({
    where: { id: cuotaId },
    include: { movimientos: { select: { id: true, monto: true } } },
  });
  if (!cuota) return { ok: false, error: "La cuota no existe." };
  let res: ReturnType<typeof deshacerPagos>;
  try {
    res = deshacerPagos(
      {
        interes: cuota.interes.toString(),
        capital: cuota.capital.toString(),
        montoPagado: cuota.montoCobrado.toString(),
        fechaVencimiento: deFechaDb(cuota.fechaVencimiento),
      },
      cuota.movimientos.map((m) => m.monto.toString()),
      hoy(),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.replace("pagos", "cobros") : "No se pudo deshacer el cobro." };
  }
  await db.$transaction(async (tx) => {
    await tx.movimiento.deleteMany({ where: { id: { in: cuota.movimientos.map((m) => m.id) } } });
    await tx.cuotaActivo.update({
      where: { id: cuota.id },
      data: { montoCobrado: res.montoPagado.toFixed(2), estado: res.estado, fechaCobro: res.estado === "PAGADA" ? cuota.fechaCobro : null },
    });
    await actualizarEstadoActivo(tx, cuota.activoId);
  });
  revalidatePath(`/activos/${cuota.activoId}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: "Cobro deshecho." };
}

// ---------------------------------------------------------------- Movimientos del activo

const TIPOS_POR_COMPORTAMIENTO: Record<string, string[]> = {
  RENTA_PROGRAMADA: ["GASTO"],
  CARTERA: ["APLICACION_ACTIVO", "COBRO_CAPITAL", "COBRO_RENDIMIENTO", "GASTO"],
  COMPRAVENTA: ["APLICACION_ACTIVO", "GASTO"],
  TENENCIA: ["APLICACION_ACTIVO", "COBRO_CAPITAL", "COBRO_RENDIMIENTO", "GASTO"],
};

const esquemaMovActivo = z.object({
  activoId: z.string().min(1),
  tipo: z.enum(["APLICACION_ACTIVO", "COBRO_CAPITAL", "COBRO_RENDIMIENTO", "GASTO"]),
  cuentaId: z.string().min(1, "Elegí la cuenta"),
  monto: zMontoPositivo,
  fecha: zFecha,
  descripcion: z.preprocess(vacioANull, z.string().trim().max(200).nullable()),
});

/** Aporte, retiro de capital, ganancia/renta cobrada o gasto directo de un activo. */
export async function registrarMovimientoActivo(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaMovActivo.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;
  const activo = await db.activo.findUnique({ where: { id: d.activoId }, include: { tipoActivo: true } });
  if (!activo) return { ok: false, error: "El activo no existe." };
  if (activo.estado !== "ACTIVO" && activo.estado !== "EN_MORA") return { ok: false, error: "El activo no está activo." };
  if (!TIPOS_POR_COMPORTAMIENTO[activo.tipoActivo.comportamiento]?.includes(d.tipo)) {
    return { ok: false, error: "Ese movimiento no corresponde a este tipo de activo." };
  }
  try {
    const tc = await tcObligatorio(d.fecha);
    await db.$transaction((tx) => crearMovimiento(tx, { ...d, activoId: activo.id }, tc), OPCIONES_TX);
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo registrar el movimiento.") };
  }
  revalidatePath(`/activos/${activo.id}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: "Movimiento registrado." };
}

// ---------------------------------------------------------------- Compraventa

const esquemaVenta = z.object({
  activoId: z.string().min(1),
  precioVenta: zMontoPositivo,
  cuentaId: z.string().min(1, "Elegí la cuenta"),
  fecha: zFecha,
});

/** Venta: COBRO_CAPITAL (costo) + COBRO_RENDIMIENTO (ganancia), o BAJA_INCOBRABLE por la pérdida. */
export async function registrarVenta(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaVenta.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;
  const activo = await db.activo.findUnique({ where: { id: d.activoId }, include: { tipoActivo: true, movimientos: true } });
  if (!activo || activo.tipoActivo.comportamiento !== "COMPRAVENTA") return { ok: false, error: "El activo no es una compraventa." };
  if (activo.fechaVenta) return { ok: false, error: "Ya registraste la venta." };
  if (d.fecha < deFechaDb(activo.fechaInicio)) return { ok: false, error: "La venta no puede ser anterior a la compra." };

  const costo = costoCompraventa({
    capitalInicial: activo.capitalInicial.toString(),
    capitalInicialRegistrado: activo.capitalInicialRegistrado,
    movimientos: activo.movimientos.map((m) => ({ tipo: m.tipo, monto: m.monto.toString() })),
  });
  const v = liquidarVenta(costo, d.precioVenta);
  try {
    const tc = await tcObligatorio(d.fecha);
    await db.$transaction(async (tx) => {
      const base = { fecha: d.fecha, activoId: activo.id };
      if (v.cobroCapital.gt(0)) {
        await crearMovimiento(tx, { ...base, tipo: "COBRO_CAPITAL", monto: v.cobroCapital.toFixed(2), cuentaId: d.cuentaId, descripcion: `Venta · recupero del costo · ${activo.nombre}` }, tc);
      }
      if (v.cobroRendimiento.gt(0)) {
        await crearMovimiento(tx, { ...base, tipo: "COBRO_RENDIMIENTO", monto: v.cobroRendimiento.toFixed(2), cuentaId: d.cuentaId, descripcion: `Venta · ganancia · ${activo.nombre}` }, tc);
      }
      if (v.perdida.gt(0)) {
        await crearMovimiento(tx, { ...base, tipo: "BAJA_INCOBRABLE", monto: v.perdida.toFixed(2), cuentaId: null, moneda: activo.moneda, descripcion: `Venta · pérdida · ${activo.nombre}` }, tc);
      }
      await tx.activo.update({
        where: { id: activo.id },
        data: { precioVenta: d.precioVenta, fechaVenta: aFechaDb(d.fecha), fechaFin: aFechaDb(d.fecha), estado: "CERRADO" },
      });
    }, OPCIONES_TX);
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo registrar la venta.") };
  }
  revalidatePath(`/activos/${activo.id}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: v.ganancia.gte(0) ? "Venta registrada." : "Venta registrada con pérdida." };
}

export async function deshacerVenta(activoId: string): Promise<ResultadoAccion> {
  await requireSession();
  const activo = await db.activo.findUnique({ where: { id: activoId } });
  if (!activo?.fechaVenta) return { ok: false, error: "Este activo no tiene una venta registrada." };
  await db.$transaction(async (tx) => {
    await tx.movimiento.deleteMany({
      where: { activoId, fecha: activo.fechaVenta!, tipo: { in: ["COBRO_CAPITAL", "COBRO_RENDIMIENTO", "BAJA_INCOBRABLE"] } },
    });
    await tx.activo.update({ where: { id: activoId }, data: { precioVenta: null, fechaVenta: null, fechaFin: null, estado: "ACTIVO" } });
  });
  revalidatePath(`/activos/${activoId}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: "Venta deshecha." };
}

// ---------------------------------------------------------------- Tenencia y cartera

const esquemaValuacion = z.object({ activoId: z.string().min(1), fecha: zFecha, valor: zMonto });

export async function actualizarValuacion(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaValuacion.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;
  if (d.fecha > hoy()) return { ok: false, error: "La fecha no puede ser futura.", campos: { fecha: "Fecha futura" } };
  const activo = await db.activo.findUnique({ where: { id: d.activoId } });
  if (!activo) return { ok: false, error: "El activo no existe." };
  await db.$transaction(async (tx) => {
    await tx.valuacion.create({ data: { activoId: activo.id, fecha: aFechaDb(d.fecha), valor: d.valor } });
    const masReciente = !activo.fechaValuacion || d.fecha >= deFechaDb(activo.fechaValuacion);
    if (masReciente) {
      await tx.activo.update({ where: { id: activo.id }, data: { valuacionActual: d.valor, fechaValuacion: aFechaDb(d.fecha) } });
    }
  });
  revalidatePath(`/activos/${activo.id}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: "Valuación guardada." };
}

const esquemaRegistro = z.object({
  activoId: z.string().min(1),
  periodo: zPeriodo,
  capitalEnCalle: zMonto,
  capitalEnMora: zMonto,
  clientesActivos: z.preprocess(vacioANull, z.coerce.number().int().min(0).nullable()),
});

/** Foto mensual de una cartera: capital en la calle, en mora y clientes. */
export async function registrarMesCartera(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaRegistro.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { activoId, periodo, ...datos } = r.data;
  await db.registroCartera.upsert({
    where: { activoId_periodo: { activoId, periodo } },
    create: { activoId, periodo, ...datos },
    update: datos,
  });
  revalidatePath(`/activos/${activoId}`);
  return { ok: true, mensaje: "Mes registrado." };
}

// ---------------------------------------------------------------- Estado, archivo y eliminación

/** Pasa el activo a INCOBRABLE y da de baja el capital pendiente (impacta Pérdidas). */
export async function marcarIncobrable(activoId: string): Promise<ResultadoAccion> {
  await requireSession();
  const activo = await db.activo.findUnique({ where: { id: activoId }, include: { tipoActivo: true } });
  if (!activo) return { ok: false, error: "El activo no existe." };
  if (!["RENTA_PROGRAMADA", "CARTERA"].includes(activo.tipoActivo.comportamiento)) {
    return { ok: false, error: "Solo los préstamos y las carteras pueden pasar a incobrables." };
  }
  if (activo.estado === "INCOBRABLE") return { ok: false, error: "Ya está marcado como incobrable." };
  const pendiente = valorActivo(await datosValuacion(activoId));
  const fecha = hoy();
  try {
    const tc = pendiente.gt(0) ? await tcObligatorio(fecha) : null;
    await db.$transaction(async (tx) => {
      if (pendiente.gt(0) && tc) {
        await crearMovimiento(
          tx,
          { tipo: "BAJA_INCOBRABLE", fecha, monto: pendiente.toFixed(2), cuentaId: null, moneda: activo.moneda, activoId, descripcion: `Baja por incobrable · ${activo.nombre}` },
          tc,
        );
      }
      await tx.activo.update({ where: { id: activoId }, data: { estado: "INCOBRABLE" } });
    }, OPCIONES_TX);
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo dar de baja el activo.") };
  }
  revalidatePath(`/activos/${activoId}`);
  revalidatePath("/activos");
  return { ok: true, mensaje: "Activo dado de baja por incobrable." };
}

export async function archivarActivo(id: string, archivar: boolean): Promise<void> {
  await requireSession();
  const activo = await db.activo.findUnique({ where: { id }, include: { cuotas: true, tipoActivo: true } });
  if (!activo) return;
  let estado: "ARCHIVADO" | "ACTIVO" | "CERRADO" = "ARCHIVADO";
  if (!archivar) {
    const cerrado =
      activo.fechaVenta !== null ||
      (activo.tipoActivo.comportamiento === "RENTA_PROGRAMADA" && activo.cuotas.length > 0 && activo.cuotas.every((c) => c.estado === "PAGADA"));
    estado = cerrado ? "CERRADO" : "ACTIVO";
  }
  await db.activo.update({ where: { id }, data: { estado } });
  revalidatePath("/activos");
  revalidatePath(`/activos/${id}`);
}

/** Solo para lo cargado por error: sin movimientos ni fondeos. Si no, se archiva. */
export async function eliminarActivo(id: string): Promise<ResultadoAccion> {
  await requireSession();
  const [movimientos, fondeos] = await Promise.all([contarMovimientosActivo(id), db.fondeo.count({ where: { activoId: id } })]);
  const evaluacion = evaluarEliminacion({ movimientos, fondeos });
  if (!evaluacion.permitido) return { ok: false, error: evaluacion.motivo };
  await db.activo.delete({ where: { id } }); // cuotas, registros y valuaciones se borran en cascada
  revalidatePath("/activos");
  redirect("/activos");
}
