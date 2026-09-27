import { describe, expect, it } from "vitest";
import { tcImplicito, validarMovimiento } from "./movimientos";

const base = { monto: "100", moneda: "ARS" as const, cuentaId: "c1", monedaCuenta: "ARS" as const };

describe("validarMovimiento (SPEC §4)", () => {
  it("gasto e ingreso exigen categoría, salvo el gasto directo de un activo", () => {
    expect(validarMovimiento({ ...base, tipo: "GASTO" })).toMatch(/categoría/);
    expect(validarMovimiento({ ...base, tipo: "GASTO", categoriaId: "k" })).toBeNull();
    expect(validarMovimiento({ ...base, tipo: "GASTO", activoId: "a" })).toBeNull();
    expect(validarMovimiento({ ...base, tipo: "INGRESO" })).toMatch(/categoría/);
  });

  it("los tipos de activo exigen activo y los de pasivo, pasivo", () => {
    expect(validarMovimiento({ ...base, tipo: "COBRO_RENDIMIENTO" })).toMatch(/activo/);
    expect(validarMovimiento({ ...base, tipo: "COBRO_RENDIMIENTO", activoId: "a" })).toBeNull();
    expect(validarMovimiento({ ...base, tipo: "PAGO_INTERES" })).toMatch(/pasivo/);
  });

  it("la moneda es la de la cuenta", () => {
    expect(validarMovimiento({ ...base, tipo: "GASTO", categoriaId: "k", monedaCuenta: "USD" })).toMatch(/moneda/);
  });

  it("transferencia: exige destino distinto y monto de destino si cambian las monedas", () => {
    expect(validarMovimiento({ ...base, tipo: "TRANSFERENCIA" })).toMatch(/destino/);
    expect(validarMovimiento({ ...base, tipo: "TRANSFERENCIA", cuentaDestinoId: "c1" })).toMatch(/distinta/);
    expect(validarMovimiento({ ...base, tipo: "TRANSFERENCIA", cuentaDestinoId: "c2", monedaCuentaDestino: "USD" })).toMatch(/entra/);
    expect(
      validarMovimiento({ ...base, tipo: "TRANSFERENCIA", cuentaDestinoId: "c2", monedaCuentaDestino: "USD", montoDestino: "0.07" }),
    ).toBeNull();
  });

  it("la baja por incobrable no usa cuenta; el resto sí", () => {
    expect(validarMovimiento({ tipo: "BAJA_INCOBRABLE", monto: "10", moneda: "ARS", activoId: "a" })).toBeNull();
    expect(validarMovimiento({ ...base, tipo: "BAJA_INCOBRABLE", activoId: "a" })).toMatch(/no usa cuenta/);
    expect(validarMovimiento({ tipo: "INGRESO", monto: "10", moneda: "ARS", categoriaId: "k" })).toMatch(/cuenta/);
  });

  it("montos: positivos; el ajuste puede ser negativo pero no cero", () => {
    expect(validarMovimiento({ ...base, tipo: "GASTO", categoriaId: "k", monto: "0" })).toMatch(/mayor a cero/);
    expect(validarMovimiento({ ...base, tipo: "AJUSTE", monto: "-50" })).toBeNull();
    expect(validarMovimiento({ ...base, tipo: "AJUSTE", monto: "0" })).toMatch(/mayor a cero/);
  });
});

describe("tcImplicito", () => {
  it("compra de USD con pesos: ARS por USD", () => {
    expect(tcImplicito("1545000", "ARS", "1000").toString()).toBe("1545");
    expect(tcImplicito("1000", "USD", "1545000").toString()).toBe("1545");
  });
});
