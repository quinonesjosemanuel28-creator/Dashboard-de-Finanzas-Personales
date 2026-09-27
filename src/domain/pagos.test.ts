import { describe, expect, it } from "vitest";
import {
  ajustarPagoCuota,
  aplicarPago,
  capitalPendiente,
  deshacerPagos,
  marcarPagadasHasta,
  pendienteCuota,
  repartirPago,
} from "./pagos";

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

describe("capitalPendiente", () => {
  it("descuenta solo lo pagado por encima del interés", () => {
    const cuotas = [
      { interes: "400", capital: "0", montoPagado: "400" },
      { interes: "0", capital: "10000", montoPagado: "2500" },
      { interes: "400", capital: "1000", montoPagado: "600" },
    ];
    expect(capitalPendiente("11000", cuotas).toString()).toBe("8300");
    expect(capitalPendiente("11000", []).toString()).toBe("11000");
  });
});

describe("deshacerPagos", () => {
  const pagada = { interes: "400", capital: "0", montoPagado: "400", fechaVencimiento: "2026-11-15" };

  it("vuelve la cuota a pendiente si todavía no venció", () => {
    const r = deshacerPagos(pagada, ["400"], "2026-11-10");
    expect([r.montoPagado.toString(), r.estado]).toEqual(["0", "PENDIENTE"]);
  });

  it("vuelve la cuota a vencida si ya pasó la fecha de pago", () => {
    expect(deshacerPagos(pagada, ["400"], "2026-11-16").estado).toBe("VENCIDA");
  });

  it("deshace todos los movimientos de la cuota (interés + capital, o pagos parciales)", () => {
    const mixta = { interes: "400", capital: "1000", montoPagado: "1400", fechaVencimiento: "2026-11-15" };
    expect(deshacerPagos(mixta, ["400", "1000"], "2026-11-10").montoPagado.toString()).toBe("0");
    expect(deshacerPagos(mixta, ["300", "100", "1000"], "2026-11-10").estado).toBe("PENDIENTE");
  });

  it("no aplica a cuotas marcadas con «pagadas hasta» (sin movimientos)", () => {
    expect(() => deshacerPagos(pagada, [], "2026-11-10")).toThrow();
  });

  it("rechaza movimientos que suman más de lo pagado", () => {
    expect(() => deshacerPagos(pagada, ["500"], "2026-11-10")).toThrow();
  });
});

describe("ajustarPagoCuota (editar o borrar un movimiento vinculado)", () => {
  const cuota = { interes: "400", capital: "0", montoPagado: "400", fechaVencimiento: "2026-11-15" };

  it("borrar el movimiento vuelve la cuota a pendiente o vencida", () => {
    expect(ajustarPagoCuota(cuota, "400", "0", "2026-11-10").estado).toBe("PENDIENTE");
    expect(ajustarPagoCuota(cuota, "400", "0", "2026-11-20").estado).toBe("VENCIDA");
  });

  it("editar el monto recalcula lo pagado y el estado", () => {
    const r = ajustarPagoCuota(cuota, "400", "250", "2026-11-10");
    expect([r.montoPagado.toString(), r.estado]).toEqual(["250", "PARCIAL"]);
  });

  it("no deja pasar más que el total de la cuota", () => {
    expect(() => ajustarPagoCuota(cuota, "400", "450", "2026-11-10")).toThrow();
  });
});
