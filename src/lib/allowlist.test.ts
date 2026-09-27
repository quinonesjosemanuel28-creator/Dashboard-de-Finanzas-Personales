import { describe, expect, it } from "vitest";
import { emailPermitido } from "./allowlist";

describe("emailPermitido", () => {
  it("acepta solo el email configurado, sin importar mayúsculas ni espacios", () => {
    expect(emailPermitido("Jose@Gmail.com ", "jose@gmail.com")).toBe(true);
    expect(emailPermitido("otro@gmail.com", "jose@gmail.com")).toBe(false);
  });

  it("rechaza todo si ALLOWED_EMAIL no está configurado o el email falta", () => {
    expect(emailPermitido("jose@gmail.com", undefined)).toBe(false);
    expect(emailPermitido("jose@gmail.com", "  ")).toBe(false);
    expect(emailPermitido(undefined, "jose@gmail.com")).toBe(false);
    expect(emailPermitido("", "")).toBe(false);
  });
});
