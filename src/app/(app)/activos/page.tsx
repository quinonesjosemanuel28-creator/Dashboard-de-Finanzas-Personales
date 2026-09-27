import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Activos" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Activos" detalle="Acá vas a ver tus activos productivos agrupados por tipo." />;
}
