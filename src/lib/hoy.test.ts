import { describe, expect, it } from "vitest";
import { fechaEnArgentina } from "./hoy";

describe("fechaEnArgentina", () => {
  it("usa la fecha de Buenos Aires (UTC−3), no la de UTC", () => {
    expect(fechaEnArgentina(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-30");
    expect(fechaEnArgentina(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });
});
