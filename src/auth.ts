import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { emailPermitido } from "@/lib/allowlist";

const TREINTA_DIAS = 30 * 24 * 60 * 60;

/**
 * Auth.js con Google y allowlist de un solo email (SPEC §9).
 * Credenciales por variables de entorno: AUTH_SECRET, AUTH_GOOGLE_ID,
 * AUTH_GOOGLE_SECRET y ALLOWED_EMAIL.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: TREINTA_DIAS },
  pages: { signIn: "/login", error: "/login" },
  // Railway sirve la app detrás de un proxy: confiamos en el host del request.
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
