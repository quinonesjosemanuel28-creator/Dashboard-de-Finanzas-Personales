"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Decimal } from "@/domain/decimal";
import { parseNumeroAR } from "@/lib/entrada";
import { db } from "@/server/db";
import {
  OPCIONES_TX,
  borrarMovimiento,
  crearMovimiento,
  editarMovimiento,
  mensajeDeError,
  registrarPagoCuota,
  tcObligatorio,
} from "@/server/movimientos";
import { requireSession } from "@/server/sesion";
import { type ResultadoAccion, falloValidacion, zFecha } from "@/server/validacion";

const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const idOpcional = z.preprocess(vacioANull, z.string().nullable());

/** Monto tipeado (es-AR); si `conSigno`, admite negativos (ajustes). */
const montoTipeado = (conSigno: boolean) =>
  z.string().transform((v, ctx) => {
    const n = parseNumeroAR(v);
    if (n === null || (!conSigno && new Decimal(n).isNeg())) {
      ctx.addIssue({ code: "custom", message: "Ingresá un monto válido" });
      return z.NEVER;
    }
    return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  });

/** Un movimiento puede cambiar saldos, cuotas, activos y pasivos: se revalida toda la app. */
function revalidarTodo() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- Editar y borrar

const esquemaEdicion = z.object({
  id: z.string().min(1),
  fecha: zFecha,
  monto: z.string(),
  cuentaId: idOpcional,
  cuentaDestinoId: idOpcional,
  montoDestino: z.preprocess(vacioANull, z.string().nullable()),
  categoriaId: idOpcional,
  descripcion: z.preprocess(vacioANull, z.string().trim().max(200).nullable()),
});

export async function guardarMovimiento(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaEdicion.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;
  const actual = await db.movimiento.findUnique({ where: { id: d.id } });
  if (!actual) return { ok: false, error: "El movimiento no existe." };

  const monto = montoTipeado(actual.tipo === "AJUSTE").safeParse(d.monto);
  if (!monto.success) return { ok: false, error: "Revisá el monto.", campos: { monto: "Monto inválido" } };
  const montoDestino = d.montoDestino ? montoTipeado(false).safeParse(d.montoDestino) : null;
  if (montoDestino && !montoDestino.success) return { ok: false, error: "Revisá el monto de destino.", campos: { montoDestino: "Monto inválido" } };

  try {
    const tc = await tcObligatorio(d.fecha);
    await db.$transaction(
      (tx) =>
        editarMovimiento(
          tx,
          d.id,
          {
            fecha: d.fecha,
            monto: monto.data,
            cuentaId: d.cuentaId,
            cuentaDestinoId: d.cuentaDestinoId,
            montoDestino: montoDestino?.success ? montoDestino.data : null,
            categoriaId: d.categoriaId,
            descripcion: d.descripcion,
          },
          tc,
        ),
      OPCIONES_TX,
    );
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo guardar el movimiento.") };
  }
  revalidarTodo();
  return { ok: true, mensaje: "Movimiento guardado." };
}

export async function eliminarMovimiento(id: string): Promise<ResultadoAccion> {
  await requireSession();
  try {
    await db.$transaction((tx) => borrarMovimiento(tx, id), OPCIONES_TX);
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo borrar el movimiento.") };
  }
  revalidarTodo();
  redirect("/movimientos");
}

// ---------------------------------------------------------------- Carga rápida

const esquemaRapido = z.object({
  tipo: z.enum([
    "INGRESO",
    "GASTO",
    "TRANSFERENCIA",
    "APLICACION_ACTIVO",
    "COBRO_RENDIMIENTO",
    "COBRO_CAPITAL",
    "TOMA_PASIVO",
    "PAGO_INTERES",
    "PAGO_CAPITAL",
    "AJUSTE",
  ]),
  monto: z.string(),
  fecha: zFecha,
  cuentaId: z.string().min(1, "Elegí la cuenta"),
  cuentaDestinoId: z.string().nullable(),
  montoDestino: z.string().nullable(),
  categoriaId: z.string().nullable(),
  activoId: z.string().nullable(),
  pasivoId: z.string().nullable(),
  cuotaActivoId: z.string().nullable(),
  cuotaPasivoId: z.string().nullable(),
  descripcion: z.string().trim().max(200).nullable(),
});

export type CargaRapida = z.input<typeof esquemaRapido>;

/** Guarda lo cargado con el botón +. Si apunta a una cuota, la paga/cobra. */
export async function guardarCargaRapida(payload: CargaRapida): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaRapido.safeParse(payload);
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;
  const monto = montoTipeado(d.tipo === "AJUSTE").safeParse(d.monto);
  if (!monto.success) return { ok: false, error: "Revisá el monto." };
  const montoDestino = d.montoDestino ? montoTipeado(false).safeParse(d.montoDestino) : null;
  if (montoDestino && !montoDestino.success) return { ok: false, error: "Revisá cuánto entra en la cuenta de destino." };

  try {
    const tc = await tcObligatorio(d.fecha);
    await db.$transaction(async (tx) => {
      if (d.cuotaPasivoId) return registrarPagoCuota(tx, "pasivo", d.cuotaPasivoId, monto.data, d.cuentaId, d.fecha, tc);
      if (d.cuotaActivoId) return registrarPagoCuota(tx, "activo", d.cuotaActivoId, monto.data, d.cuentaId, d.fecha, tc);
      return crearMovimiento(
        tx,
        {
          tipo: d.tipo,
          fecha: d.fecha,
          monto: monto.data,
          cuentaId: d.cuentaId,
          cuentaDestinoId: d.cuentaDestinoId,
          montoDestino: montoDestino?.success ? montoDestino.data : null,
          categoriaId: d.categoriaId,
          activoId: d.activoId,
          pasivoId: d.pasivoId,
          descripcion: d.descripcion,
        },
        tc,
      );
    }, OPCIONES_TX);
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo guardar.") };
  }
  revalidarTodo();
  return { ok: true, mensaje: "Guardado." };
}
