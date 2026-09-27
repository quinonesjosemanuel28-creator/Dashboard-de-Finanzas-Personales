import { describe, expect, it } from "vitest";
import { resolverUrlPublica } from "./url-publica";

describe("resolverUrlPublica", () => {
  it("usa AUTH_URL si está configurada, sin path ni barra final", () => {
    expect(
      resolverUrlPublica({ AUTH_URL: "https://patrimonio.ejemplo.com/", RAILWAY_PUBLIC_DOMAIN: "x.up.railway.app" }),
    ).toBe("https://patrimonio.ejemplo.com");
    expect(resolverUrlPublica({ NEXTAUTH_URL: "https://a.com/api/auth" })).toBe("https://a.com");
  });

  it("si no hay AUTH_URL, usa el dominio público de Railway con https", () => {
    expect(resolverUrlPublica({ RAILWAY_PUBLIC_DOMAIN: "patrimonio-production.up.railway.app" })).toBe(
      "https://patrimonio-production.up.railway.app",
    );
  });

  it("sin ninguna de las dos, no inventa una URL (en desarrollo se usa el host del request)", () => {
    expect(resolverUrlPublica({})).toBeUndefined();
    expect(resolverUrlPublica({ AUTH_URL: " ", RAILWAY_PUBLIC_DOMAIN: "" })).toBeUndefined();
  });
});
