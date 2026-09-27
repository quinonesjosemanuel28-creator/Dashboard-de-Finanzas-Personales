import { describe, expect, it } from "vitest";
import { aplicarPago, marcarPagadasHasta, pendienteCuota, repartirPago } from "./pagos";

const cuota = { interes: "400", capital: "1000", montoPagado: "0", fechaVencimiento: "2026-11-15" };

describe("repartirPago", () => {
  it("aplica primero al interés y después al capital", () => {
    const r = repartirPago({ ...cuota, montoPagado: "300" }, "500");
    expect([r.interes.toString(), r.capital.toString()]).toEqual(["100", "400"]);
  });

  it("no acepta montos en cero ni mayores a lo pendiente", () => {
    expect(() => repartirPago(cuota, "0")).toThrow();
    expect(() => repartirPago(cuota, "1400.01")).toThrow();
    expect(pendienteCuota({ ...cuota, montoPagado: "1400" }).toString()).toBe("0");
  });
});

describe("aplicarPago", () => {
  it("pago total deja la cuota PAGADA; parcial en término, PARCIAL", () => {
    expect(aplicarPago(cuota, "1400", "2026-11-15").estado).toBe("PAGADA");
    const parcial = aplicarPago(cuota, "400", "2026-11-10");
    expect([parcial.montoPagado.toString(), parcial.estado]).toEqual(["400", "PARCIAL"]);
    expect(aplicarPago(cuota, "400", "2026-11-20").estado).toBe("VENCIDA");
  });
});

describe("marcarPagadasHasta", () => {
  const cuotas = [
    { interes: "400", capital: "0", montoPagado: "0", fechaVencimiento: "2026-08-15" },
    { interes: "400", capital: "0", montoPagado: "0", fechaVencimiento: "2026-09-15" },
    { interes: "400", capital: "0", montoPagado: "0", fechaVencimiento: "2026-10-15" },
  ];

  it("marca pagadas las cuotas que vencen hasta el mes indicado, sin tocar el resto", () => {
    const r = marcarPagadasHasta(cuotas, "2026-08", "2026-09-27");
    expect(r.map((c) => c.estado)).toEqual(["PAGADA", "VENCIDA", "PENDIENTE"]);
    expect(r[0]!.fechaPago).toBe("2026-08-15");
    expect(r[0]!.montoPagado.toString()).toBe("400");
    expect(r[1]!.fechaPago).toBeNull();
  });

  it("sin mes indicado, calcula el estado según hoy", () => {
    expect(marcarPagadasHasta(cuotas, null, "2026-09-27").map((c) => c.estado)).toEqual([
      "VENCIDA",
      "VENCIDA",
      "PENDIENTE",
    ]);
  });
});
