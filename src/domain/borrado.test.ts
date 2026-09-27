import { describe, expect, it } from "vitest";
import { evaluarEliminacion } from "./borrado";

describe("evaluarEliminacion", () => {
  it("permite eliminar lo que no tiene movimientos ni fondeos", () => {
    expect(evaluarEliminacion({ movimientos: 0 })).toEqual({ permitido: true });
    expect(evaluarEliminacion({ movimientos: 0, fondeos: 0 })).toEqual({ permitido: true });
  });

  it("con movimientos, solo se archiva", () => {
    const r = evaluarEliminacion({ movimientos: 2 });
    expect(r.permitido).toBe(false);
    expect(!r.permitido && r.motivo).toContain("2 movimientos vinculados");
    const uno = evaluarEliminacion({ movimientos: 1 });
    expect(!uno.permitido && uno.motivo).toContain("1 movimiento vinculado");
  });

  it("con fondeos, solo se archiva", () => {
    expect(evaluarEliminacion({ movimientos: 0, fondeos: 1 }).permitido).toBe(false);
  });
});
