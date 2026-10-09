import { describe, expect, it } from "vitest";
import { describirError, lineaDeError, sanearArgumento, sanearMensaje } from "./logs";

const errorPrisma = `
Invalid \`prisma.movimiento.create()\` invocation:

{
  data: {
    monto: "987654.32",
    tipo: "GASTO"
  }
}

Argument \`fecha\` is missing.`;

describe("sanearMensaje", () => {
  it("de un error de Prisma deja la invocación y el motivo, sin los argumentos", () => {
    const m = sanearMensaje(errorPrisma);
    expect(m).toBe("Invalid `prisma.movimiento.create()` invocation: Argument `fecha` is missing.");
    expect(m).not.toContain("987");
  });

  it("tapa montos en cualquier formato y deja los números chicos", () => {
    expect(sanearMensaje("Pago de ARS 1.234.567,89 en la cuota 3")).toBe("Pago de ARS ‹n› en la cuota 3");
    expect(sanearMensaje("monto 250000 y 45")).toBe("monto ‹n› y 45");
  });

  it("mantiene el motivo de una tabla faltante", () => {
    const m = sanearMensaje("Invalid `prisma.activo.findMany()` invocation:\n\nThe table `public.Activo` does not exist in the current database.");
    expect(m).toContain("The table `public.Activo` does not exist");
  });
});

describe("lineaDeError", () => {
  it("arma una línea con digest, ruta sin query, código de Prisma y mensaje saneado", () => {
    const err = Object.assign(new Error(errorPrisma), { name: "PrismaClientValidationError", code: "P2009", digest: "1961344711" });
    const linea = lineaDeError(err, { ruta: "/movimientos?q=45000", tipo: "render" });
    expect(linea).toMatch(/^\[error\] digest=1961344711 ruta=\/movimientos tipo=render nombre=PrismaClientValidationError codigo=P2009 mensaje="/);
    expect(linea).not.toContain("987654");
    expect(linea).not.toContain("45000");
  });
});

describe("sanearArgumento", () => {
  it("convierte un Error en texto saneado con algunos marcos del stack", () => {
    const texto = sanearArgumento(new Error("monto 987654.32 inválido")) as string;
    expect(texto.split("\n")[0]).toBe("Error: monto ‹n› inválido");
    expect(texto).toContain("at ");
  });

  it("deja pasar lo que no es texto ni error", () => {
    expect(sanearArgumento(42)).toBe(42);
    expect(describirError("algo").nombre).toBe("Error");
  });
});

describe("protegerConsola + registrarError", () => {
  it("la consola protegida tapa montos, pero la línea [error] conserva el digest y el código", async () => {
    const { protegerConsola, registrarError } = await import("./logs");
    const salida: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => salida.push(args.map(String).join(" "));
    try {
      protegerConsola();
      console.error(new Error("monto 987654.32"));
      registrarError(Object.assign(new Error("tabla faltante"), { code: "P2021", digest: "1961344711" }), { ruta: "/activos" });
    } finally {
      console.error = original;
    }
    expect(salida[0]).toContain("Error: monto ‹n›");
    expect(salida[1]).toContain("digest=1961344711");
    expect(salida[1]).toContain("codigo=P2021");
  });
});
