import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Pasivos" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Pasivos" detalle="Acá vas a ver tus mutuos con inversores y sus cronogramas." />;
}
