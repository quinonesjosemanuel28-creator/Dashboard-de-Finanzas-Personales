import { describe, expect, it } from "vitest";
import { parseNumeroAR, parsePorcentajeAR } from "./entrada";

describe("parseNumeroAR", () => {
  it("entiende el formato es-AR", () => {
    expect(parseNumeroAR("1.234.567,89")).toBe("1234567.89");
    expect(parseNumeroAR("10.000")).toBe("10000");
    expect(parseNumeroAR("10000")).toBe("10000");
    expect(parseNumeroAR("1545,5")).toBe("1545.5");
    expect(parseNumeroAR(" USD 400 ")).toBe("400");
  });

  it("sin coma, un punto que no agrupa miles es decimal", () => {
    expect(parseNumeroAR("1545.50")).toBe("1545.50");
    expect(parseNumeroAR("0.5")).toBe("0.5");
  });

  it("rechaza lo que no es número", () => {
    expect(parseNumeroAR("")).toBeNull();
    expect(parseNumeroAR("abc")).toBeNull();
    expect(parseNumeroAR("1,2,3")).toBeNull();
  });
});

describe("parsePorcentajeAR", () => {
  it("convierte porcentaje a fracción sin perder precisión", () => {
    expect(parsePorcentajeAR("4")).toBe("0.04");
    expect(parsePorcentajeAR("4,5")).toBe("0.045");
    expect(parsePorcentajeAR("30")).toBe("0.3");
    expect(parsePorcentajeAR("100")).toBe("1");
    expect(parsePorcentajeAR("2 %")).toBe("0.02");
    expect(parsePorcentajeAR("0,125")).toBe("0.00125");
    expect(parsePorcentajeAR("0")).toBe("0");
  });
});
