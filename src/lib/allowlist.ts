/**
 * Allowlist de un solo email (SPEC §9). Se compara sin distinguir mayúsculas
 * ni espacios. Si ALLOWED_EMAIL no está configurado, no entra nadie.
 */
export function normalizarEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function emailPermitido(
  email: string | null | undefined,
  permitido: string | undefined = process.env.ALLOWED_EMAIL,
): boolean {
  const esperado = normalizarEmail(permitido);
  return esperado !== "" && normalizarEmail(email) === esperado;
}
