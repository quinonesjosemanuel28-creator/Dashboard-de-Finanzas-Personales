import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { emailPermitido } from "@/lib/allowlist";

/**
 * Verifica sesión + ALLOWED_EMAIL (regla 6). Se llama al principio de cada
 * página protegida y de cada server action; sin sesión válida, va a /login.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email || !emailPermitido(session.user.email)) {
    redirect("/login");
  }
  return session;
}
