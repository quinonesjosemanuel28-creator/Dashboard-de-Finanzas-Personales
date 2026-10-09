"use server";

import { registrarError } from "@/lib/logs";
import { requireSession } from "@/server/sesion";

/**
 * Registra en el log del servidor un error que ocurrió en el navegador (los
 * errores del servidor ya los registra `onRequestError`). Mensaje saneado,
 * sin montos.
 */
export async function reportarErrorCliente(datos: { nombre: string; mensaje: string; ruta: string }): Promise<void> {
  await requireSession();
  registrarError(
    { name: datos.nombre.slice(0, 80), message: datos.mensaje.slice(0, 2000) },
    { ruta: datos.ruta.slice(0, 200), tipo: "cliente" },
  );
}
