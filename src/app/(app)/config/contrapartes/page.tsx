import type { Metadata } from "next";
import { BotonNuevo } from "@/components/config/boton-nuevo";
import { ListaConfig } from "@/components/config/lista-config";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { TIPOS_CONTRAPARTE } from "@/lib/etiquetas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Contrapartes" };

export default async function ContrapartesPage() {
  await requireSession();
  const contrapartes = await db.contraparte.findMany({ orderBy: { nombre: "asc" } });
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Contrapartes" volver="/config" accion={<BotonNuevo href="/config/contrapartes/nueva" texto="Nueva" />} />
      <ListaConfig
        base="/config/contrapartes"
        vacio="Todavía no cargaste inversores ni deudores. También se crean desde el alta de un pasivo."
        items={contrapartes.map((c) => ({ id: c.id, titulo: c.nombre, detalle: TIPOS_CONTRAPARTE[c.tipo] }))}
      />
    </section>
  );
}
