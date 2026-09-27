import { describe, expect, it } from "vitest";
import { formatMonto, formatNumero, formatTasa } from "./dinero";

describe("formato es-AR", () => {
  it("usa punto de miles y coma decimal", () => {
    expect(formatNumero("1234567.891")).toBe("1.234.567,89");
    expect(formatNumero("400")).toBe("400,00");
    expect(formatNumero("0.005")).toBe("0,01");
    expect(formatNumero("-1500000")).toBe("-1.500.000,00");
    expect(formatNumero("-0.001")).toBe("0,00");
    expect(formatNumero("1545.5", 0)).toBe("1.546");
  });

  it("muestra siempre la moneda", () => {
    expect(formatMonto("10000", "USD")).toBe("USD 10.000,00");
    expect(formatMonto("8000000", "ARS")).toBe("ARS 8.000.000,00");
  });

  it("formatea tasas mensuales", () => {
    expect(formatTasa("0.04")).toBe("4,00 %");
    expect(formatTasa("0.035")).toBe("3,50 %");
  });
});
