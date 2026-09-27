import { describe, expect, it } from "vitest";
import { diasDeAtraso, estadoCuota, punitorioEstimado } from "./cuotas";

const cuota = { interes: "400", capital: "0", montoPagado: "0", fechaVencimiento: "2026-11-15" };

describe("estadoCuota", () => {
  it("sigue PENDIENTE el mismo día de pago", () => {
    expect(estadoCuota(cuota, "2026-11-15")).toBe("PENDIENTE");
  });

  it("pasa a VENCIDA al día siguiente de la fecha de pago", () => {
    expect(estadoCuota(cuota, "2026-11-16")).toBe("VENCIDA");
  });

  it("un pago parcial en término queda PARCIAL y vencido queda VENCIDA", () => {
    const parcial = { ...cuota, montoPagado: "100" };
    expect(estadoCuota(parcial, "2026-11-10")).toBe("PARCIAL");
    expect(estadoCuota(parcial, "2026-11-16")).toBe("VENCIDA");
  });

  it("pago total queda PAGADA aunque se consulte después", () => {
    expect(estadoCuota({ ...cuota, montoPagado: "400" }, "2027-01-01")).toBe("PAGADA");
  });
});

describe("punitorio", () => {
  it("corre desde el día siguiente a la fecha de pago", () => {
    expect(diasDeAtraso("2026-11-15", "2026-11-15")).toBe(0);
    expect(diasDeAtraso("2026-11-15", "2026-11-16")).toBe(1);
    expect(punitorioEstimado(cuota, "0.02", "2026-11-15").toString()).toBe("0");
  });

  it("= interés impago × punitorio mensual × días de atraso / 30", () => {
    expect(punitorioEstimado(cuota, "0.02", "2026-11-30").toString()).toBe("4");
    expect(punitorioEstimado({ ...cuota, montoPagado: "200" }, "0.02", "2026-11-30").toString()).toBe("2");
  });
});
