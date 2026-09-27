import "server-only";
import { Decimal } from "@/domain/decimal";
import type { Fecha } from "@/domain/fechas";
import { fechaEnArgentina, hoy } from "@/lib/hoy";
import { db } from "@/server/db";
import { aFechaDb, deFechaDb } from "@/server/fechas-db";

export interface TcVigente {
  fecha: Fecha;
  venta: Decimal;
}

const URL_DOLARAPI = "https://dolarapi.com/v1/dolares/oficial";

/**
 * Trae el oficial de dolarapi y lo guarda con la fecha de su última
 * actualización (en ART). No pisa un TC cargado a mano.
 */
export async function actualizarTcDesdeDolarapi(): Promise<TcVigente | null> {
  try {
    const res = await fetch(URL_DOLARAPI, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
    if (typeof json.venta !== "number" || typeof json.compra !== "number" || typeof json.fechaActualizacion !== "string") {
      return null;
    }
    const fecha = fechaEnArgentina(new Date(json.fechaActualizacion));
    const venta = new Decimal(String(json.venta));
    const compra = new Decimal(String(json.compra));
    const existente = await db.tipoCambio.findUnique({ where: { fecha: aFechaDb(fecha) } });
    if (existente?.manual) return { fecha, venta: new Decimal(existente.venta.toString()) };
    await db.tipoCambio.upsert({
      where: { fecha: aFechaDb(fecha) },
      create: { fecha: aFechaDb(fecha), compra: compra.toFixed(4), venta: venta.toFixed(4), fuente: "dolarapi" },
      update: { compra: compra.toFixed(4), venta: venta.toFixed(4), fuente: "dolarapi", manual: false },
    });
    return { fecha, venta };
  } catch {
    return null;
  }
}

/**
 * TC vigente para una fecha: el de ese día o el último anterior (SPEC §5.1).
 * Si la fecha es hoy y no hay TC de hoy, intenta traerlo de dolarapi.
 */
export async function obtenerTcVigente(fecha: Fecha): Promise<TcVigente | null> {
  const buscar = async () => {
    const tc = await db.tipoCambio.findFirst({
      where: { fecha: { lte: aFechaDb(fecha) } },
      orderBy: { fecha: "desc" },
    });
    return tc ? { fecha: deFechaDb(tc.fecha), venta: new Decimal(tc.venta.toString()) } : null;
  };
  const tc = await buscar();
  if (fecha === hoy() && tc?.fecha !== fecha) {
    const nuevo = await actualizarTcDesdeDolarapi();
    if (nuevo) return (await buscar()) ?? tc;
  }
  return tc;
}
