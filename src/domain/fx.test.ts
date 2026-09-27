import { describe, expect, it } from "vitest";
import { convertir, tcDesactualizado, tcVigente } from "./fx";

describe("convertir", () => {
  it("USD = ARS / TC y ARS = USD × TC", () => {
    expect(convertir("1545000", "ARS", "USD", "1545").toString()).toBe("1000");
    expect(convertir("1000", "USD", "ARS", "1545.5").toString()).toBe("1545500");
    expect(convertir("100", "ARS", "ARS", "1545").toString()).toBe("100");
  });
});

describe("tcDesactualizado", () => {
  it("alerta con más de 4 días corridos sin actualizar", () => {
    expect(tcDesactualizado("2026-09-25", "2026-09-29")).toBe(false);
    expect(tcDesactualizado("2026-09-25", "2026-09-30")).toBe(true);
    expect(tcDesactualizado(null, "2026-09-30")).toBe(true);
  });
});

describe("tcVigente", () => {
  const tcs = [
    { fecha: "2026-09-24", venta: "1540" },
    { fecha: "2026-09-25", venta: "1545" },
  ];

  it("usa el de la fecha o el último anterior", () => {
    expect(tcVigente(tcs, "2026-09-25")?.venta).toBe("1545");
    expect(tcVigente(tcs, "2026-09-27")?.venta).toBe("1545");
    expect(tcVigente(tcs, "2026-09-24")?.venta).toBe("1540");
    expect(tcVigente(tcs, "2026-09-01")).toBeNull();
  });
});
