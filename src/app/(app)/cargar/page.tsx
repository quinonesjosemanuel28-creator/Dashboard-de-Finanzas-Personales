import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Cargar" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Cargar" detalle="Carga rápida: tipo, monto, destino y cuenta, en 4 taps." />;
}
