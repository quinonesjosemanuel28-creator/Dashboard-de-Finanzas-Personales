import type { Metadata } from "next";
import { FormCategoria } from "@/components/config/form-categoria";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nueva categoría" };

export default async function NuevaCategoriaPage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nueva categoría" volver="/config/categorias" />
      <FormCategoria categoria={{ nombre: "", tipo: "GASTO", grupoER: "GASTO_VARIABLE" }} />
    </section>
  );
}
