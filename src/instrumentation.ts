import type { Instrumentation } from "next";

/** Al arrancar el servidor: ningún console.error/warn imprime montos (regla 6). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { protegerConsola } = await import("@/lib/logs");
    protegerConsola();
  }
}

/**
 * Cada error del servidor deja una línea `[error] digest=…` en el log. El
 * digest es el código que el usuario ve en la pantalla de error.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { registrarError } = await import("@/lib/logs");
  registrarError(err, { ruta: request.path, metodo: request.method, tipo: context.routeType, origen: context.routePath });
};
