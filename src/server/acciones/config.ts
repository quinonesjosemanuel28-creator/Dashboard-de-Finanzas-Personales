"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { aFechaDb } from "@/server/fechas-db";
import { requireSession } from "@/server/sesion";
import {
  type ResultadoAccion,
  falloValidacion,
  zFecha,
  zMonto,
  zMontoPositivo,
} from "@/server/validacion";

const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const textoOpcional = z.preprocess(vacioANull, z.string().trim().max(500).nullable());
const nombre = z.string().trim().min(1, "Poné un nombre").max(80);

// ---------------------------------------------------------------- Cuentas

const esquemaCuenta = z.object({
  id: z.preprocess(vacioANull, z.string().nullable()),
  nombre,
  tipo: z.enum(["EFECTIVO", "BANCO", "BILLETERA_VIRTUAL", "BROKER", "OTRO"]),
  moneda: z.enum(["ARS", "USD"]),
  saldoInicial: zMonto,
  fechaSaldoInicial: zFecha,
});

export async function guardarCuenta(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaCuenta.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { id, fechaSaldoInicial, ...datos } = r.data;
  const data = { ...datos, fechaSaldoInicial: aFechaDb(fechaSaldoInicial) };

  if (id) {
    const actual = await db.cuenta.findUnique({ where: { id } });
    if (!actual) return { ok: false, error: "La cuenta no existe." };
    if (actual.moneda !== data.moneda) {
      const usada = await db.movimiento.count({ where: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] } });
      if (usada > 0) return { ok: false, error: "No podés cambiar la moneda de una cuenta con movimientos." };
    }
    await db.cuenta.update({ where: { id }, data });
  } else {
    await db.cuenta.create({ data });
  }
  revalidatePath("/config/cuentas");
  redirect("/config/cuentas");
}

export async function archivarCuenta(id: string, archivar: boolean): Promise<void> {
  await requireSession();
  await db.cuenta.update({ where: { id }, data: { archivada: archivar } });
  revalidatePath("/config/cuentas");
}

// ---------------------------------------------------------------- Categorías

const esquemaCategoria = z.object({
  id: z.preprocess(vacioANull, z.string().nullable()),
  nombre,
  tipo: z.enum(["INGRESO", "GASTO"]),
  grupoER: z.enum(["INGRESO_PERSONAL", "GASTO_FIJO", "GASTO_VARIABLE", "COSTO_FINANCIERO_OTRO", "OTRO"]),
});

export async function guardarCategoria(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaCategoria.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { id, ...data } = r.data;
  if (data.tipo === "INGRESO" && data.grupoER !== "INGRESO_PERSONAL" && data.grupoER !== "OTRO") {
    return { ok: false, error: "Una categoría de ingreso va en el grupo «Ingreso personal» u «Otro».", campos: { grupoER: "Grupo no válido para un ingreso" } };
  }
  if (data.tipo === "GASTO" && data.grupoER === "INGRESO_PERSONAL") {
    return { ok: false, error: "Una categoría de gasto no puede ir en «Ingreso personal».", campos: { grupoER: "Grupo no válido para un gasto" } };
  }
  const repetida = await db.categoria.findFirst({ where: { nombre: data.nombre, tipo: data.tipo, NOT: id ? { id } : undefined } });
  if (repetida) return { ok: false, error: "Ya existe una categoría con ese nombre.", campos: { nombre: "Nombre repetido" } };

  if (id) await db.categoria.update({ where: { id }, data });
  else await db.categoria.create({ data });
  revalidatePath("/config/categorias");
  redirect("/config/categorias");
}

export async function archivarCategoria(id: string, archivar: boolean): Promise<void> {
  await requireSession();
  await db.categoria.update({ where: { id }, data: { archivada: archivar } });
  revalidatePath("/config/categorias");
}

// ---------------------------------------------------------------- Tipos de activo

const esquemaTipoActivo = z.object({
  id: z.preprocess(vacioANull, z.string().nullable()),
  nombre,
  comportamiento: z.enum(["RENTA_PROGRAMADA", "CARTERA", "COMPRAVENTA", "TENENCIA"]),
});

export async function guardarTipoActivo(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaTipoActivo.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { id, ...data } = r.data;
  const repetido = await db.tipoActivo.findFirst({ where: { nombre: data.nombre, NOT: id ? { id } : undefined } });
  if (repetido) return { ok: false, error: "Ya existe un tipo con ese nombre.", campos: { nombre: "Nombre repetido" } };

  if (id) {
    const actual = await db.tipoActivo.findUnique({ where: { id }, include: { _count: { select: { activos: true } } } });
    if (!actual) return { ok: false, error: "El tipo de activo no existe." };
    if (actual.comportamiento !== data.comportamiento && actual._count.activos > 0) {
      return { ok: false, error: "No podés cambiar el comportamiento de un tipo que ya tiene activos." };
    }
    await db.tipoActivo.update({ where: { id }, data });
  } else {
    await db.tipoActivo.create({ data });
  }
  revalidatePath("/config/tipos-activo");
  redirect("/config/tipos-activo");
}

export async function archivarTipoActivo(id: string, archivar: boolean): Promise<void> {
  await requireSession();
  await db.tipoActivo.update({ where: { id }, data: { archivado: archivar } });
  revalidatePath("/config/tipos-activo");
}

// ---------------------------------------------------------------- Contrapartes

const esquemaContraparte = z.object({
  id: z.preprocess(vacioANull, z.string().nullable()),
  nombre,
  tipo: z.enum(["INVERSOR", "DEUDOR", "AMBOS", "OTRO"]),
  telefono: textoOpcional,
  email: z.preprocess(vacioANull, z.email("Email inválido").nullable()),
  notas: textoOpcional,
});

export async function guardarContraparte(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaContraparte.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { id, ...data } = r.data;
  if (id) await db.contraparte.update({ where: { id }, data });
  else await db.contraparte.create({ data });
  revalidatePath("/config/contrapartes");
  redirect("/config/contrapartes");
}

// ---------------------------------------------------------------- TC manual

const esquemaTc = z.object({ fecha: zFecha, compra: zMontoPositivo, venta: zMontoPositivo });

export async function guardarTcManual(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaTc.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const fecha = aFechaDb(r.data.fecha);
  const data = { compra: r.data.compra, venta: r.data.venta, fuente: "manual", manual: true };
  await db.tipoCambio.upsert({ where: { fecha }, create: { fecha, ...data }, update: data });
  revalidatePath("/config/tipo-cambio");
  return { ok: true, mensaje: "Tipo de cambio guardado." };
}
