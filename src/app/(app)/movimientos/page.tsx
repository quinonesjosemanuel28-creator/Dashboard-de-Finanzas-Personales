import type { Metadata } from "next";
import { EnConstruccion } from "@/components/en-construccion";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Movimientos" };

export default async function Page() {
  await requireSession();
  return <EnConstruccion titulo="Movimientos" detalle="Acá vas a ver y filtrar todos tus movimientos." />;
}
