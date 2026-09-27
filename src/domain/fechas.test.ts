import { describe, expect, it } from "vitest";
import { diasDelMes, diasEntre, parseFecha, sumarMeses, sumarMesesPeriodo } from "./fechas";

describe("fechas", () => {
  it("días del mes, con bisiestos", () => {
    expect(diasDelMes(2027, 2)).toBe(28);
    expect(diasDelMes(2028, 2)).toBe(29);
    expect(diasDelMes(2026, 12)).toBe(31);
  });

  it("suma meses cruzando años", () => {
    expect(sumarMeses(2026, 11, 2)).toEqual({ anio: 2027, mes: 1 });
    expect(sumarMeses(2027, 1, -1)).toEqual({ anio: 2026, mes: 12 });
    expect(sumarMesesPeriodo("2026-10", 24)).toBe("2028-10");
  });

  it("días corridos entre fechas", () => {
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
    expect(diasEntre("2026-11-16", "2026-11-15")).toBe(-1);
  });

  it("rechaza fechas inexistentes", () => {
    expect(() => parseFecha("2027-02-29")).toThrow();
    expect(() => parseFecha("2026-13-01")).toThrow();
  });
});
