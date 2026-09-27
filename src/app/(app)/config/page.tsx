import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Configuración" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Configuración" detalle="Cuentas, categorías, tipos de activo y contrapartes." />;
}
