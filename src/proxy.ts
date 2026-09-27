/**
 * Protege todas las rutas salvo login, endpoints de Auth.js, cron (usa su
 * propio secret) y archivos públicos de la PWA. Cada página y server action
 * vuelve a verificar la sesión con `requireSession()`.
 */
export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon|apple-icon).*)",
  ],
};
