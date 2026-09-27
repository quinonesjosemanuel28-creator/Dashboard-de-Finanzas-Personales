"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CERO, Decimal } from "@/domain/decimal";
import { evaluarEliminacion } from "@/domain/borrado";
import { deshacerPagos, marcarPagadasHasta } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import { contarMovimientosPasivo } from "@/server/consultas/pasivos";
import { db } from "@/server/db";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";
import {
  OPCIONES_TX,
  actualizarEstadoPasivo,
  mensajeDeError,
  registrarPagoCuota,
  tcObligatorio,
} from "@/server/movimientos";
import { requireSession } from "@/server/sesion";
import { obtenerTcVigente } from "@/server/tipo-cambio";
import {
  type ResultadoAccion,
  falloValidacion,
  zDecimal,
  zFecha,
  zMontoPositivo,
  zPeriodo,
} from "@/server/validacion";

const zNoNegativo = zDecimal.refine((v) => !new Decimal(v).isNeg(), "No puede ser negativo");

const esquemaCuota = z.object({
  numero: z.number().int().min(1),
  fechaVencimiento: zFecha,
  periodoDesde: zPeriodo,
  mesesCubiertos: z.number().int().min(0),
  interes: zNoNegativo,
  capital: zNoNegativo,
});

const esquemaAlta = z
  .object({
    contraparteId: z.string().nullable(),
    contraparteNueva: z.string().trim().max(80).nullable(),
    nombre: z.string().trim().min(1, "Poné un nombre").max(80),
    tipo: z.enum(["MUTUO_INVERSOR", "PRESTAMO", "TARJETA", "OTRO"]),
    moneda: z.enum(["ARS", "USD"]),
    capital: zDecimal.refine((v) => new Decimal(v).gt(0), "El capital tiene que ser mayor a cero"),
    tasaMensual: zNoNegativo,
    esquema: z.enum(["INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO", "CUOTAS_IGUALES_INTERES_DIRECTO"]),
    fechaInicio: zFecha,
    fechaVencimiento: zFecha,
    plazoMeses: z.number().int().min(1).max(600),
    diaPago: z.number().int().min(1).max(31),
    frecuenciaPago: z.enum(["MENSUAL", "TRIMESTRAL", "CUATRIMESTRAL", "SEMESTRAL", "ANUAL"]),
    instrumentacion: z.enum(["PERSONAL", "SOCIEDAD"]),
    preavisoDias: z.number().int().min(0).nullable(),
    penalidadRetiroPct: zNoNegativo.nullable(),
    punitorioMensual: zNoNegativo.nullable(),
    notas: z.string().trim().max(500).nullable(),
    cuotas: z.array(esquemaCuota).min(1, "El cronograma no tiene cuotas"),
    pagadasHasta: zPeriodo.nullable(),
    ingresoCapitalCuentaId: z.string().nullable(),
  })
  .refine((v) => v.fechaVencimiento > v.fechaInicio, {
    message: "El vencimiento tiene que ser posterior al inicio",
    path: ["fechaVencimiento"],
  });

export type AltaPasivo = z.input<typeof esquemaAlta>;

export async function crearPasivo(payload: AltaPasivo): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaAlta.safeParse(payload);
  if (!r.success) return falloValidacion(r.error);
  const d = r.data;

  // El cronograma se puede editar, pero tiene que devolver todo el capital.
  const capitalCuotas = d.cuotas.reduce((s, c) => s.add(c.capital), CERO);
  if (!capitalCuotas.eq(d.capital)) {
    return { ok: false, error: `Las cuotas devuelven ${capitalCuotas.toFixed(2)} de capital y el pasivo es de ${new Decimal(d.capital).toFixed(2)}. Revisá el cronograma.` };
  }
  const numeros = d.cuotas.map((c) => c.numero);
  if (new Set(numeros).size !== numeros.length) return { ok: false, error: "Hay cuotas con el mismo número." };

  if (!d.contraparteId && !d.contraparteNueva) {
    return { ok: false, error: "Elegí o cargá el inversor.", campos: { contraparte: "Falta el inversor" } };
  }

  const fechaHoy = hoy();
  const cuotas = marcarPagadasHasta(
    d.cuotas.map((c) => ({ ...c, montoPagado: "0" })),
    d.pagadasHasta,
    fechaHoy,
  );
  const todasPagadas = cuotas.every((c) => c.estado === "PAGADA");

  let tcIngreso: Decimal | null = null;
  if (d.ingresoCapitalCuentaId) {
    const cuenta = await db.cuenta.findUnique({ where: { id: d.ingresoCapitalCuentaId } });
    if (!cuenta || cuenta.archivada) return { ok: false, error: "La cuenta elegida no existe." };
    if (cuenta.moneda !== d.moneda) return { ok: false, error: `La cuenta tiene que ser en ${d.moneda}.` };
    const tc = await obtenerTcVigente(d.fechaInicio);
    if (!tc) {
      return { ok: false, error: "No hay tipo de cambio para la fecha de inicio. Cargalo en Configuración → Tipo de cambio." };
    }
    tcIngreso = tc.venta;
  }

  const pasivo = await db.$transaction(async (tx) => {
    const contraparteId =
      d.contraparteId ??
      (await tx.contraparte.create({ data: { nombre: d.contraparteNueva!, tipo: "INVERSOR" } })).id;

    const creado = await tx.pasivo.create({
      data: {
        nombre: d.nombre,
        tipo: d.tipo,
        contraparteId,
        moneda: d.moneda,
        capital: d.capital,
        tasaMensual: d.tasaMensual,
        esquema: d.esquema,
        fechaInicio: aFechaDb(d.fechaInicio),
        fechaVencimiento: aFechaDb(d.fechaVencimiento),
        plazoMeses: d.plazoMeses,
        diaPago: d.diaPago,
        frecuenciaPago: d.frecuenciaPago,
        instrumentacion: d.instrumentacion,
        regularizacion: d.instrumentacion === "SOCIEDAD" ? "PENDIENTE" : "NO_APLICA",
        preavisoDias: d.preavisoDias,
        penalidadRetiroPct: d.penalidadRetiroPct,
        punitorioMensual: d.punitorioMensual,
        notas: d.notas,
        estado: todasPagadas ? "CANCELADO" : "VIGENTE",
        cuotas: {
          create: cuotas.map((c) => ({
            numero: c.numero,
            fechaVencimiento: aFechaDb(c.fechaVencimiento),
            periodoDesde: c.periodoDesde,
            mesesCubiertos: c.mesesCubiertos,
            interes: c.interes,
            capital: c.capital,
            estado: c.estado,
            montoPagado: c.montoPagado.toFixed(2),
            fechaPago: c.fechaPago ? aFechaDb(c.fechaPago) : null,
          })),
        },
      },
    });

    if (d.ingresoCapitalCuentaId && tcIngreso) {
      await tx.movimiento.create({
        data: {
          fecha: aFechaDb(d.fechaInicio),
          tipo: "TOMA_PASIVO",
          monto: d.capital,
          moneda: d.moneda,
          tipoCambio: tcIngreso.toFixed(4),
          cuentaId: d.ingresoCapitalCuentaId,
          pasivoId: creado.id,
          descripcion: `Ingreso de capital · ${d.nombre}`,
        },
      });
    }
    return creado;
  });

  revalidatePath("/pasivos");
  return { ok: true, id: pasivo.id };
}

// ---------------------------------------------------------------- Pagar cuota

const esquemaPago = z.object({
  cuotaId: z.string().min(1),
  cuentaId: z.string().min(1, "Elegí la cuenta"),
  monto: zMontoPositivo,
  fecha: zFecha,
});

export async function pagarCuota(_: ResultadoAccion | null, form: FormData): Promise<ResultadoAccion> {
  await requireSession();
  const r = esquemaPago.safeParse(Object.fromEntries(form));
  if (!r.success) return falloValidacion(r.error);
  const { cuotaId, cuentaId, monto, fecha } = r.data;

  const cuota = await db.cuotaPasivo.findUnique({ where: { id: cuotaId }, include: { pasivo: true } });
  if (!cuota) return { ok: false, error: "La cuota no existe." };
  if (cuota.pasivo.estado === "ARCHIVADO") return { ok: false, error: "El pasivo está archivado." };

  try {
    const tc = await tcObligatorio(fecha);
    const resultado = await db.$transaction((tx) => registrarPagoCuota(tx, "pasivo", cuotaId, monto, cuentaId, fecha, tc), OPCIONES_TX);
    revalidatePath(`/pasivos/${cuota.pasivoId}`);
    revalidatePath("/pasivos");
    return { ok: true, mensaje: resultado.estado === "PAGADA" ? "Cuota pagada." : "Pago parcial registrado." };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e, "No se pudo registrar el pago.") };
  }
}

// ---------------------------------------------------------------- Archivar

export async function archivarPasivo(id: string, archivar: boolean): Promise<void> {
  await requireSession();
  const pasivo = await db.pasivo.findUnique({ where: { id }, include: { cuotas: true } });
  if (!pasivo) return;
  let estado: "ARCHIVADO" | "VIGENTE" | "CANCELADO" = "ARCHIVADO";
  if (!archivar) estado = pasivo.cuotas.every((c) => c.estado === "PAGADA") ? "CANCELADO" : "VIGENTE";
  await db.pasivo.update({ where: { id }, data: { estado } });
  revalidatePath("/pasivos");
  revalidatePath(`/pasivos/${id}`);
}

// ---------------------------------------------------------------- Deshacer pago

/** Borra los movimientos de pago de la cuota y la vuelve a su estado según hoy. */
export async function deshacerPago(cuotaId: string): Promise<ResultadoAccion> {
  await requireSession();
  const cuota = await db.cuotaPasivo.findUnique({
    where: { id: cuotaId },
    include: { pasivo: true, movimientos: { select: { id: true, monto: true } } },
  });
  if (!cuota) return { ok: false, error: "La cuota no existe." };

  let resultado: ReturnType<typeof deshacerPagos>;
  try {
    resultado = deshacerPagos(
      {
        interes: cuota.interes.toString(),
        capital: cuota.capital.toString(),
        montoPagado: cuota.montoPagado.toString(),
        fechaVencimiento: deFechaDb(cuota.fechaVencimiento),
      },
      cuota.movimientos.map((m) => m.monto.toString()),
      hoy(),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo deshacer el pago." };
  }

  await db.$transaction(async (tx) => {
    await tx.movimiento.deleteMany({ where: { id: { in: cuota.movimientos.map((m) => m.id) } } });
    await tx.cuotaPasivo.update({
      where: { id: cuota.id },
      data: {
        montoPagado: resultado.montoPagado.toFixed(2),
        estado: resultado.estado,
        fechaPago: resultado.estado === "PAGADA" ? cuota.fechaPago : null,
      },
    });
    await actualizarEstadoPasivo(tx, cuota.pasivoId);
  });

  revalidatePath(`/pasivos/${cuota.pasivoId}`);
  revalidatePath("/pasivos");
  return { ok: true, mensaje: "Pago deshecho." };
}

// ---------------------------------------------------------------- Eliminar

/** Solo para lo cargado por error: sin movimientos ni fondeos. Si no, se archiva. */
export async function eliminarPasivo(id: string): Promise<ResultadoAccion> {
  await requireSession();
  const [movimientos, fondeos] = await Promise.all([
    contarMovimientosPasivo(id),
    db.fondeo.count({ where: { pasivoId: id } }),
  ]);
  const evaluacion = evaluarEliminacion({ movimientos, fondeos });
  if (!evaluacion.permitido) return { ok: false, error: evaluacion.motivo };
  await db.pasivo.delete({ where: { id } }); // las cuotas se borran en cascada
  revalidatePath("/pasivos");
  redirect("/pasivos");
}
