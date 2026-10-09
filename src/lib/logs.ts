/**
 * Logs del servidor sin montos (regla 6). Los errores de Prisma traen los
 * argumentos de la consulta en el mensaje (por ejemplo `{ monto: "250000" }`),
 * así que antes de loguear se recortan y se tapan los números largos.
 */

const NUMERO_LARGO = /\d(?:[\d.,]*\d)?/g;

/** Tapa números de 3 o más dígitos (montos, importes, IDs numéricos). */
function taparNumeros(texto: string): string {
  return texto.replace(NUMERO_LARGO, (n) => (n.replace(/\D/g, "").length >= 3 ? "‹n›" : n));
}

/**
 * Mensaje apto para el log:
 * - "Invalid `prisma.x.y()` invocation: … <argumentos> … <motivo>": queda la
 *   primera línea y la última (el motivo); se descartan los argumentos.
 * - Se tapan los números de 3 o más dígitos y se acorta a 300 caracteres.
 */
export function sanearMensaje(texto: string): string {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  let resumen = lineas.join(" ");
  if (lineas.length > 1 && /invocation/i.test(lineas[0] ?? "")) {
    resumen = `${lineas[0]} ${lineas[lineas.length - 1]}`;
  }
  const limpio = taparNumeros(resumen);
  return limpio.length > 300 ? `${limpio.slice(0, 300)}…` : limpio;
}

export interface DatosError {
  nombre: string;
  codigo: string | null;
  mensaje: string;
  digest: string | null;
}

/** Extrae lo que se puede loguear de cualquier valor lanzado. */
export function describirError(err: unknown): DatosError {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; message?: unknown; code?: unknown; digest?: unknown };
    return {
      nombre: typeof e.name === "string" ? e.name : "Error",
      codigo: typeof e.code === "string" ? e.code : null,
      mensaje: sanearMensaje(typeof e.message === "string" ? e.message : String(err)),
      digest: typeof e.digest === "string" ? e.digest : null,
    };
  }
  return { nombre: "Error", codigo: null, mensaje: sanearMensaje(String(err)), digest: null };
}

/**
 * Una línea por error, fácil de buscar en Railway por el código que ve el
 * usuario en pantalla: `[error] digest=… ruta=… tipo=… nombre=… codigo=… mensaje=…`.
 */
export function lineaDeError(err: unknown, contexto: Record<string, string | undefined> = {}): string {
  const d = describirError(err);
  const campos: [string, string | null | undefined][] = [
    ["digest", d.digest ?? contexto.digest],
    ...Object.entries(contexto).filter(([k]) => k !== "digest"),
    ["nombre", d.nombre],
    ["codigo", d.codigo],
    ["mensaje", JSON.stringify(d.mensaje)],
  ];
  return `[error] ${campos
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${k === "ruta" ? (v as string).split("?")[0] : v}`)
    .join(" ")}`;
}

/** Saneo de un argumento de console.error / console.warn. */
export function sanearArgumento(arg: unknown): unknown {
  if (arg instanceof Error) {
    const d = describirError(arg);
    const marcos = (arg.stack ?? "").split("\n").filter((l) => l.trim().startsWith("at ")).slice(0, 8);
    return [`${d.nombre}${d.codigo ? ` [${d.codigo}]` : ""}: ${d.mensaje}${d.digest ? ` (digest ${d.digest})` : ""}`, ...marcos].join("\n");
  }
  if (typeof arg === "string") return sanearMensaje(arg);
  return arg;
}

/**
 * console.error sin envolver, para líneas que ya salen saneadas (así no se
 * tapa el digest). Va en globalThis porque Next empaqueta cada ruta por
 * separado y el estado de este módulo no se comparte con la instrumentación.
 */
const CLAVE_ORIGINAL = Symbol.for("patrimonio.consola.errorOriginal");
type ConConsolaOriginal = { [CLAVE_ORIGINAL]?: (...args: unknown[]) => void };

/** Escribe en el log una línea armada con `lineaDeError` (ya saneada). */
export function registrarError(err: unknown, contexto: Record<string, string | undefined> = {}): void {
  const escribir = (globalThis as ConConsolaOriginal)[CLAVE_ORIGINAL] ?? console.error;
  escribir(lineaDeError(err, contexto));
}

/**
 * Envuelve console.error y console.warn del servidor para que nada (tampoco
 * los logs propios de Next.js o Prisma) imprima montos.
 */
export function protegerConsola(): void {
  const global = globalThis as ConConsolaOriginal;
  if (global[CLAVE_ORIGINAL]) return;
  global[CLAVE_ORIGINAL] = console.error.bind(console);
  for (const metodo of ["error", "warn"] as const) {
    const original = console[metodo].bind(console);
    console[metodo] = (...args: unknown[]) => original(...args.map(sanearArgumento));
  }
}
