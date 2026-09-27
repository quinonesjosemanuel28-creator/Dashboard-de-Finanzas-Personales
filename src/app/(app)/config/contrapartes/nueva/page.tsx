import type { Metadata } from "next";
import { FormContraparte } from "@/components/config/form-contraparte";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nueva contraparte" };

export default async function NuevaContrapartePage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nueva contraparte" volver="/config/contrapartes" />
      <FormContraparte contraparte={{ nombre: "", tipo: "INVERSOR", telefono: "", email: "", notas: "" }} />
    </section>
  );
}
