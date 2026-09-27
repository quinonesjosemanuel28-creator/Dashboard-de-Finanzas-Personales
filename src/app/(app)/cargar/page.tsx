import type { Metadata } from "next";
import { CargaRapida } from "@/components/carga-rapida";
import { datosCargaRapida } from "@/server/consultas/carga-rapida";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Cargar" };

export default async function CargarPage() {
  await requireSession();
  const datos = await datosCargaRapida();
  return <CargaRapida datos={datos} />;
}
