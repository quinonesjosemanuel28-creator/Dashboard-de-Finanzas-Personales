import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { emailPermitido } from "@/lib/allowlist";

export const metadata: Metadata = { title: "Ingresar" };

const MENSAJES_ERROR: Record<string, string> = {
  AccessDenied: "Ese email no tiene acceso a esta app.",
  Configuration: "Falta configurar el acceso con Google. Revisá las variables de entorno.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (emailPermitido(session?.user?.email)) redirect("/");

  const { error } = await searchParams;
  const mensaje = error ? (MENSAJES_ERROR[error] ?? "No pudimos iniciar sesión. Probá de nuevo.") : null;

  async function ingresar() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Patrimonio</h1>
        <p className="text-muted-foreground">Tus activos, tus pasivos y tu patrimonio neto, en un solo lugar.</p>
      </div>
      {mensaje && (
        <p role="alert" className="border-negativo/40 text-negativo rounded-md border p-3 text-sm">
          {mensaje}
        </p>
      )}
      <form action={ingresar}>
        <Button type="submit" size="lg" className="w-full">
          Ingresá con Google
        </Button>
      </form>
    </main>
  );
}
