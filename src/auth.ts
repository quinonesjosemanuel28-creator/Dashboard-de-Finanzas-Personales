import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { emailPermitido } from "@/lib/allowlist";
import { resolverUrlPublica } from "@/lib/url-publica";

const TREINTA_DIAS = 30 * 24 * 60 * 60;

// Auth.js arma todas sus URLs (redirect_uri de Google, redirecciones de login,
// logout y del proxy) con AUTH_URL si existe; si no, con el host del request,
// que detrás de Railway es el interno (localhost:8080). Fijamos AUTH_URL con la
// URL pública antes de inicializar Auth.js.
const urlPublica = resolverUrlPublica(process.env);
if (urlPublica) {
  process.env.AUTH_URL = urlPublica;
} else if (process.env.NODE_ENV === "production") {
  console.warn("[auth] Falta AUTH_URL (o RAILWAY_PUBLIC_DOMAIN): las redirecciones usarán el host del request.");
}

/**
 * Auth.js con Google y allowlist de un solo email (SPEC §9).
 * Credenciales por variables de entorno: AUTH_SECRET, AUTH_GOOGLE_ID,
 * AUTH_GOOGLE_SECRET y ALLOWED_EMAIL.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: TREINTA_DIAS },
  pages: { signIn: "/login", error: "/login" },
  // La app corre detrás del proxy de Railway. Las URLs salen de AUTH_URL (ver arriba).
  trustHost: true,
  callbacks: {
    // Solo entra el email de ALLOWED_EMAIL, y con el email verificado por Google.
    signIn({ profile }) {
      return profile?.email_verified === true && emailPermitido(profile.email);
    },
    // Lo usa el proxy: sin sesión válida, redirige a /login.
    authorized({ auth }) {
      return emailPermitido(auth?.user?.email);
    },
  },
});
