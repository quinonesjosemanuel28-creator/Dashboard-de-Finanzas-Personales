import { registrarError } from "@/lib/logs";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Healthcheck de Railway: la app solo está sana si la base responde y tiene el
 * esquema migrado y el seed (existe la fila de Configuracion). Si no, 503 y
 * el deploy no queda online. No requiere sesión ni devuelve datos.
 */
export async function GET() {
  try {
    await db.configuracion.findUniqueOrThrow({ where: { id: 1 }, select: { id: true } });
    return Response.json({ ok: true });
  } catch (e) {
    registrarError(e, { ruta: "/api/salud", tipo: "healthcheck" });
    return Response.json({ ok: false, error: "La base no está lista: revisá que se hayan aplicado las migraciones." }, { status: 503 });
  }
}
