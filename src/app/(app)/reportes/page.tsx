import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Reportes" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Reportes" detalle="Estado de resultados, flujo de caja y balance llegan en la Fase 2." />;
}
