import { cookies } from "next/headers";
import { Encabezado } from "@/components/encabezado";
import { NavInferior } from "@/components/nav-inferior";
import { OcultarMontosProvider } from "@/components/ocultar-montos";
import { COOKIE_OCULTAR_MONTOS } from "@/lib/preferencias";
import { requireSession } from "@/server/sesion";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const ocultar = (await cookies()).get(COOKIE_OCULTAR_MONTOS)?.value === "1";

  return (
    <OcultarMontosProvider inicial={ocultar}>
      <Encabezado />
      <main className="mx-auto max-w-md px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
      <NavInferior />
    </OcultarMontosProvider>
  );
}
