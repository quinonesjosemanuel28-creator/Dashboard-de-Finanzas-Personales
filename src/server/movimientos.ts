import "server-only";
import { Decimal } from "@/domain/decimal";
import type { Fecha } from "@/domain/fechas";
import { type TipoMovimiento, validarMovimiento } from "@/domain/movimientos";
import { ajustarPagoCuota, repartirPago } from "@/domain/pagos";
import { hoy } from "@/lib/hoy";
import type { Prisma } from "@/generated/prisma/client";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";
import { obtenerTcVigente } from "@/server/tipo-cambio";

/** Error con un mensaje para mostrar tal cual en la UI. */
export class ErrorUsuario extends Error {}

type Tx = Prisma.TransactionClient;

export async function tcObligatorio(fecha: Fecha): Promise<Decimal> {
  const tc = await obtenerTcVigente(fecha);
  if (!tc) throw new ErrorUsuario("No hay tipo de cambio para esa fecha. Cargalo en Configuración → Tipo de cambio.");
  return tc.venta;
}

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  fecha: Fecha;
  monto: string;
  cuentaId: string | null;
  cuentaDestinoId?: string | null;
  montoDestino?: string | null;
  categoriaId?: string | null;
  activoId?: string | null;
  pasivoId?: string | null;
  cuotaActivoId?: string | null;
  cuotaPasivoId?: string | null;
  descripcion?: string | null;
  /** Moneda cuando no hay cuenta (BAJA_INCOBRABLE): la del activo. */
  moneda?: "ARS" | "USD";
}

/**
 * Valida (SPEC §4) y crea un movimiento con la moneda de la cuenta. El TC se
 * obtiene antes de la transacción (`tcObligatorio`), porque puede consultar
 * dolarapi. No toca cuotas: para eso están las funciones de abajo.
 */
export async function crearMovimiento(tx: Tx, d: DatosMovimiento, tc: Decimal) {
  if (d.fecha > hoy()) throw new ErrorUsuario("La fecha no puede ser futura.");
  const cuenta = d.cuentaId ? await tx.cuenta.findUnique({ where: { id: d.cuentaId } }) : null;
  if (d.cuentaId && (!cuenta || cuenta.archivada)) throw new ErrorUsuario("La cuenta no existe.");
  const destino = d.cuentaDestinoId ? await tx.cuenta.findUnique({ where: { id: d.cuentaDestinoId } }) : null;
  if (d.cuentaDestinoId && (!destino || destino.archivada)) throw new ErrorUsuario("La cuenta de destino no existe.");
  const moneda = cuenta?.moneda ?? d.moneda;
  if (!moneda) throw new ErrorUsuario("Falta la moneda.");

  const error = validarMovimiento({
    tipo: d.tipo,
    monto: d.monto,
    moneda,
    cuentaId: d.cuentaId,
    monedaCuenta: cuenta?.moneda ?? null,
    cuentaDestinoId: d.cuentaDestinoId,
    monedaCuentaDestino: destino?.moneda ?? null,
    montoDestino: d.montoDestino,
    categoriaId: d.categoriaId,
    activoId: d.activoId,
    pasivoId: d.pasivoId,
  });
  if (error) throw new ErrorUsuario(error);

  if (d.activoId) {
    const activo = await tx.activo.findUnique({ where: { id: d.activoId } });
    if (!activo) throw new ErrorUsuario("El activo no existe.");
    if (activo.moneda !== moneda) throw new ErrorUsuario(`La cuenta tiene que ser en ${activo.moneda}, la moneda del activo.`);
  }
  if (d.pasivoId) {
    const pasivo = await tx.pasivo.findUnique({ where: { id: d.pasivoId } });
    if (!pasivo) throw new ErrorUsuario("El pasivo no existe.");
    if (pasivo.moneda !== moneda) throw new ErrorUsuario(`La cuenta tiene que ser en ${pasivo.moneda}, la moneda del pasivo.`);
  }

  const mismaMoneda = !destino || destino.moneda === moneda;
  return tx.movimiento.create({
    data: {
      tipo: d.tipo,
      fecha: aFechaDb(d.fecha),
      monto: new Decimal(d.monto).toFixed(2),
      moneda,
      tipoCambio: tc.toFixed(4),
      cuentaId: d.cuentaId,
      cuentaDestinoId: d.cuentaDestinoId ?? null,
      montoDestino: d.tipo === "TRANSFERENCIA" && !mismaMoneda && d.montoDestino ? new Decimal(d.montoDestino).toFixed(2) : null,
      categoriaId: d.categoriaId ?? null,
      activoId: d.activoId ?? null,
      pasivoId: d.pasivoId ?? null,
      cuotaActivoId: d.cuotaActivoId ?? null,
      cuotaPasivoId: d.cuotaPasivoId ?? null,
      descripcion: d.descripcion?.trim() || null,
    },
  });
}

// ---------------------------------------------------------------- Cuotas

type LadoCuota = "pasivo" | "activo";

async function leerCuota(tx: Tx, lado: LadoCuota, cuotaId: string) {
  const c =
    lado === "pasivo"
      ? await tx.cuotaPasivo.findUnique({ where: { id: cuotaId } })
      : await tx.cuotaActivo.findUnique({ where: { id: cuotaId } });
  if (!c) throw new ErrorUsuario("La cuota no existe.");
  const montoPagado = "montoPagado" in c ? c.montoPagado : c.montoCobrado;
  const padreId = "pasivoId" in c ? c.pasivoId : c.activoId;
  return {
    id: c.id,
    numero: c.numero,
    padreId,
    fechaPago: "fechaPago" in c ? c.fechaPago : c.fechaCobro,
    datos: {
      interes: c.interes.toString(),
      capital: c.capital.toString(),
      montoPagado: montoPagado.toString(),
      fechaVencimiento: deFechaDb(c.fechaVencimiento),
    },
  };
}

async function guardarCuota(
  tx: Tx,
  lado: LadoCuota,
  cuotaId: string,
  montoPagado: Decimal,
  estado: "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA",
  fechaPago: Date | null,
) {
  if (lado === "pasivo") {
    await tx.cuotaPasivo.update({ where: { id: cuotaId }, data: { montoPagado: montoPagado.toFixed(2), estado, fechaPago } });
  } else {
    await tx.cuotaActivo.update({ where: { id: cuotaId }, data: { montoCobrado: montoPagado.toFixed(2), estado, fechaCobro: fechaPago } });
  }
}

/** Pasivo: CANCELADO si todas sus cuotas están pagadas; si no, VIGENTE (salvo archivado o en preaviso). */
export async function actualizarEstadoPasivo(tx: Tx, pasivoId: string) {
  const pasivo = await tx.pasivo.findUnique({ where: { id: pasivoId } });
  if (!pasivo || pasivo.estado === "ARCHIVADO") return;
  const impagas = await tx.cuotaPasivo.count({ where: { pasivoId, estado: { not: "PAGADA" } } });
  if (impagas === 0 && pasivo.estado !== "CANCELADO") await tx.pasivo.update({ where: { id: pasivoId }, data: { estado: "CANCELADO" } });
  if (impagas > 0 && pasivo.estado === "CANCELADO") await tx.pasivo.update({ where: { id: pasivoId }, data: { estado: "VIGENTE" } });
}

/** Activo con cronograma: CERRADO si todas sus cuotas están cobradas; si no, ACTIVO. */
export async function actualizarEstadoActivo(tx: Tx, activoId: string) {
  const activo = await tx.activo.findUnique({ where: { id: activoId }, include: { tipoActivo: true } });
  if (!activo || activo.tipoActivo.comportamiento !== "RENTA_PROGRAMADA") return;
  if (activo.estado !== "ACTIVO" && activo.estado !== "CERRADO") return;
  const impagas = await tx.cuotaActivo.count({ where: { activoId, estado: { not: "PAGADA" } } });
  if (impagas === 0 && activo.estado === "ACTIVO") await tx.activo.update({ where: { id: activoId }, data: { estado: "CERRADO" } });
  if (impagas > 0 && activo.estado === "CERRADO") await tx.activo.update({ where: { id: activoId }, data: { estado: "ACTIVO" } });
}

/**
 * Registra el pago (pasivo) o el cobro (activo) de una cuota: reparte el monto
 * entre interés y capital, crea los movimientos vinculados y actualiza la cuota.
 */
export async function registrarPagoCuota(
  tx: Tx,
  lado: LadoCuota,
  cuotaId: string,
  monto: string,
  cuentaId: string,
  fecha: Fecha,
  tc: Decimal,
) {
  const cuota = await leerCuota(tx, lado, cuotaId);
  let partes: { interes: Decimal; capital: Decimal };
  try {
    partes = repartirPago(cuota.datos, monto);
  } catch (e) {
    throw new ErrorUsuario(e instanceof Error ? e.message : "Monto inválido.");
  }
  const nombre =
    lado === "pasivo"
      ? (await tx.pasivo.findUniqueOrThrow({ where: { id: cuota.padreId } })).nombre
      : (await tx.activo.findUniqueOrThrow({ where: { id: cuota.padreId } })).nombre;
  const [tipoInteres, tipoCapital] =
    lado === "pasivo" ? (["PAGO_INTERES", "PAGO_CAPITAL"] as const) : (["COBRO_RENDIMIENTO", "COBRO_CAPITAL"] as const);
  const vinculo =
    lado === "pasivo"
      ? { pasivoId: cuota.padreId, cuotaPasivoId: cuota.id }
      : { activoId: cuota.padreId, cuotaActivoId: cuota.id };

  if (partes.interes.gt(0)) {
    await crearMovimiento(tx, { tipo: tipoInteres, fecha, monto: partes.interes.toFixed(2), cuentaId, ...vinculo, descripcion: `Interés cuota ${cuota.numero} · ${nombre}` }, tc);
  }
  if (partes.capital.gt(0)) {
    await crearMovimiento(tx, { tipo: tipoCapital, fecha, monto: partes.capital.toFixed(2), cuentaId, ...vinculo, descripcion: `Capital cuota ${cuota.numero} · ${nombre}` }, tc);
  }
  const r = ajustarPagoCuota(cuota.datos, "0", monto, hoy());
  await guardarCuota(tx, lado, cuota.id, r.montoPagado, r.estado, r.estado === "PAGADA" ? aFechaDb(fecha) : cuota.fechaPago);
  if (lado === "pasivo") await actualizarEstadoPasivo(tx, cuota.padreId);
  else await actualizarEstadoActivo(tx, cuota.padreId);
  return r;
}

/** Recalcula la cuota vinculada cuando un movimiento cambia de monto (o se borra: montoNuevo = 0). */
async function reajustarCuota(tx: Tx, lado: LadoCuota, cuotaId: string, montoAnterior: string, montoNuevo: string) {
  const cuota = await leerCuota(tx, lado, cuotaId);
  let r: ReturnType<typeof ajustarPagoCuota>;
  try {
    r = ajustarPagoCuota(cuota.datos, montoAnterior, montoNuevo, hoy());
  } catch (e) {
    throw new ErrorUsuario(e instanceof Error ? e.message : "No se pudo ajustar la cuota.");
  }
  await guardarCuota(tx, lado, cuota.id, r.montoPagado, r.estado, r.estado === "PAGADA" ? cuota.fechaPago : null);
  if (lado === "pasivo") await actualizarEstadoPasivo(tx, cuota.padreId);
  else await actualizarEstadoActivo(tx, cuota.padreId);
}

/** Borra un movimiento y deshace sus efectos sobre la cuota o el activo vinculado. */
export async function borrarMovimiento(tx: Tx, id: string) {
  const m = await tx.movimiento.findUnique({ where: { id }, include: { activo: { include: { tipoActivo: true } } } });
  if (!m) throw new ErrorUsuario("El movimiento no existe.");
  if (esMovimientoDeVenta(m)) throw new ErrorUsuario("Este movimiento es parte de una venta: deshacé la venta desde el activo.");
  await tx.movimiento.delete({ where: { id } });
  if (m.cuotaPasivoId) await reajustarCuota(tx, "pasivo", m.cuotaPasivoId, m.monto.toString(), "0");
  if (m.cuotaActivoId) await reajustarCuota(tx, "activo", m.cuotaActivoId, m.monto.toString(), "0");
  if (m.tipo === "BAJA_INCOBRABLE" && m.activo?.estado === "INCOBRABLE") {
    await tx.activo.update({ where: { id: m.activo.id }, data: { estado: "ACTIVO" } });
  }
  return m;
}

export interface CambiosMovimiento {
  fecha: Fecha;
  monto: string;
  cuentaId: string | null;
  cuentaDestinoId: string | null;
  montoDestino: string | null;
  categoriaId: string | null;
  descripcion: string | null;
}

/**
 * Edita un movimiento (el tipo y sus vínculos no cambian). Revalida, toma el TC
 * de la nueva fecha y recalcula la cuota vinculada si cambió el monto.
 */
export async function editarMovimiento(tx: Tx, id: string, c: CambiosMovimiento, tcNuevaFecha: Decimal) {
  const m = await tx.movimiento.findUnique({ where: { id }, include: { activo: { include: { tipoActivo: true } } } });
  if (!m) throw new ErrorUsuario("El movimiento no existe.");
  if (esMovimientoDeVenta(m)) throw new ErrorUsuario("Este movimiento es parte de una venta: deshacé la venta desde el activo.");
  if (c.fecha > hoy()) throw new ErrorUsuario("La fecha no puede ser futura.");

  const cuenta = c.cuentaId ? await tx.cuenta.findUnique({ where: { id: c.cuentaId } }) : null;
  const destino = c.cuentaDestinoId ? await tx.cuenta.findUnique({ where: { id: c.cuentaDestinoId } }) : null;
  const moneda = cuenta?.moneda ?? m.moneda;
  if ((m.activoId || m.pasivoId) && moneda !== m.moneda) {
    throw new ErrorUsuario(`La cuenta tiene que ser en ${m.moneda}.`);
  }
  const error = validarMovimiento({
    tipo: m.tipo,
    monto: c.monto,
    moneda,
    cuentaId: c.cuentaId,
    monedaCuenta: cuenta?.moneda ?? null,
    cuentaDestinoId: c.cuentaDestinoId,
    monedaCuentaDestino: destino?.moneda ?? null,
    montoDestino: c.montoDestino,
    categoriaId: c.categoriaId,
    activoId: m.activoId,
    pasivoId: m.pasivoId,
  });
  if (error) throw new ErrorUsuario(error);

  const fechaAnterior = deFechaDb(m.fecha);
  const tc = fechaAnterior === c.fecha ? new Decimal(m.tipoCambio.toString()) : tcNuevaFecha;
  const mismaMoneda = !destino || destino.moneda === moneda;
  await tx.movimiento.update({
    where: { id },
    data: {
      fecha: aFechaDb(c.fecha),
      monto: new Decimal(c.monto).toFixed(2),
      moneda,
      tipoCambio: tc.toFixed(4),
      cuentaId: c.cuentaId,
      cuentaDestinoId: c.cuentaDestinoId,
      montoDestino: m.tipo === "TRANSFERENCIA" && !mismaMoneda && c.montoDestino ? new Decimal(c.montoDestino).toFixed(2) : null,
      categoriaId: c.categoriaId,
      descripcion: c.descripcion?.trim() || null,
    },
  });
  const cambioMonto = !new Decimal(c.monto).eq(m.monto.toString());
  if (cambioMonto && m.cuotaPasivoId) await reajustarCuota(tx, "pasivo", m.cuotaPasivoId, m.monto.toString(), c.monto);
  if (cambioMonto && m.cuotaActivoId) await reajustarCuota(tx, "activo", m.cuotaActivoId, m.monto.toString(), c.monto);
}

/** Movimientos que genera "Registrar venta" de una compraventa: se deshacen desde el activo. */
function esMovimientoDeVenta(m: {
  tipo: string;
  fecha: Date;
  activo: { tipoActivo: { comportamiento: string }; fechaVenta: Date | null } | null;
}): boolean {
  if (!m.activo || m.activo.tipoActivo.comportamiento !== "COMPRAVENTA" || !m.activo.fechaVenta) return false;
  return ["COBRO_CAPITAL", "COBRO_RENDIMIENTO", "BAJA_INCOBRABLE"].includes(m.tipo) && m.fecha.getTime() === m.activo.fechaVenta.getTime();
}

/** Mensaje para la UI a partir de un error del servicio. */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  return e instanceof ErrorUsuario ? e.message : porDefecto;
}

/** Opciones de las transacciones que registran movimientos. */
export const OPCIONES_TX = { timeout: 15_000 } as const;
