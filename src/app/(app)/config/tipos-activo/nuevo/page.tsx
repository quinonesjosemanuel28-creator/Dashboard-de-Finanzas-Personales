import type { Metadata } from "next";
import { FormTipoActivo } from "@/components/config/form-tipo-activo";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nuevo tipo de activo" };

export default async function NuevoTipoActivoPage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nuevo tipo de activo" volver="/config/tipos-activo" />
      <FormTipoActivo tipo={{ nombre: "", comportamiento: "CARTERA" }} />
    </section>
  );
}
