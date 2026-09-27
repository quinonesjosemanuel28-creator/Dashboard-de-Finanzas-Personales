/**
 * URL pública de la app, para que Auth.js arme las redirecciones (login,
 * logout, callback de Google, protección de rutas) con el dominio público.
 *
 * Detrás del proxy de Railway, el header `host` que llega al servidor es el
 * interno (p. ej. `localhost:8080`), así que no se puede deducir del request.
 * Orden: AUTH_URL (o NEXTAUTH_URL) explícita → dominio público de Railway.
 */
type Entorno = Record<string, string | undefined>;

export function resolverUrlPublica(env: Entorno): string | undefined {
  const explicita = env.AUTH_URL?.trim() || env.NEXTAUTH_URL?.trim();
  if (explicita) return new URL(explicita).origin;
  const dominioRailway = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (dominioRailway) return `https://${dominioRailway}`;
  return undefined;
}
