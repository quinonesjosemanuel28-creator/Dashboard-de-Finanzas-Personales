import { describe, expect, it } from "vitest";
import { costoCompraventa, liquidarVenta, valorActivo } from "./activos";

describe("compraventa (criterio de aceptación de la Fase 1)", () => {
  const datos = {
    comportamiento: "COMPRAVENTA" as const,
    capitalInicial: "8000000",
    capitalInicialRegistrado: true,
    movimientos: [
      { tipo: "APLICACION_ACTIVO", monto: "8000000" },
      { tipo: "GASTO", monto: "300000" },
      { tipo: "GASTO", monto: "200000" },
    ],
  };

  it("el costo total capitaliza los gastos directos", () => {
    expect(costoCompraventa(datos).toString()).toBe("8500000");
    expect(valorActivo(datos).toString()).toBe("8500000");
  });

  it("vendida a 10.000.000 da una ganancia de 1.500.000 y sale del balance", () => {
    const v = liquidarVenta(costoCompraventa(datos), "10000000");
    expect(v.ganancia.toString()).toBe("1500000");
    expect(v.cobroCapital.toString()).toBe("8500000");
    expect(v.cobroRendimiento.toString()).toBe("1500000");
    expect(v.perdida.toString()).toBe("0");
    expect(valorActivo({ ...datos, vendido: true }).toString()).toBe("0");
  });

  it("con pérdida, cobra el precio y da de baja la diferencia", () => {
    const v = liquidarVenta("8500000", "8000000");
    expect([v.ganancia.toString(), v.cobroCapital.toString(), v.cobroRendimiento.toString(), v.perdida.toString()]).toEqual([
      "-500000", "8000000", "0", "500000",
    ]);
  });

  it("si el capital inicial no salió de una cuenta, cuenta como base", () => {
    expect(costoCompraventa({ capitalInicial: "8000000", capitalInicialRegistrado: false, movimientos: [] }).toString()).toBe("8000000");
  });
});

describe("valorActivo", () => {
  it("CARTERA: aportes − retiros − bajas", () => {
    const v = valorActivo({
      comportamiento: "CARTERA",
      capitalInicial: "1000000",
      capitalInicialRegistrado: false,
      movimientos: [
        { tipo: "APLICACION_ACTIVO", monto: "500000" },
        { tipo: "COBRO_CAPITAL", monto: "200000" },
        { tipo: "BAJA_INCOBRABLE", monto: "100000" },
        { tipo: "COBRO_RENDIMIENTO", monto: "90000" },
      ],
    });
    expect(v.toString()).toBe("1200000");
  });

  it("RENTA_PROGRAMADA: capital pendiente de cobro según las cuotas", () => {
    const d = {
      comportamiento: "RENTA_PROGRAMADA" as const,
      capitalInicial: "10000",
      capitalInicialRegistrado: true,
      movimientos: [{ tipo: "APLICACION_ACTIVO", monto: "10000" }],
      cuotas: [
        { interes: "800", capital: "0", montoPagado: "800" },
        { interes: "0", capital: "10000", montoPagado: "4000" },
      ],
    };
    expect(valorActivo(d).toString()).toBe("6000");
    expect(valorActivo({ ...d, movimientos: [...d.movimientos, { tipo: "BAJA_INCOBRABLE", monto: "6000" }] }).toString()).toBe("0");
  });

  it("TENENCIA: la valuación actual, o el costo si no hay", () => {
    const base = { comportamiento: "TENENCIA" as const, capitalInicial: "50000", capitalInicialRegistrado: false, movimientos: [] };
    expect(valorActivo(base).toString()).toBe("50000");
    expect(valorActivo({ ...base, valuacionActual: "62000" }).toString()).toBe("62000");
  });
});
