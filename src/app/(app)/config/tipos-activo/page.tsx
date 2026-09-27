import type { Metadata } from "next";
import { BotonNuevo } from "@/components/config/boton-nuevo";
import { ListaConfig } from "@/components/config/lista-config";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { COMPORTAMIENTOS } from "@/lib/etiquetas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Tipos de activo" };

export default async function TiposActivoPage() {
  await requireSession();
  const tipos = await db.tipoActivo.findMany({ orderBy: { nombre: "asc" } });
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Tipos de activo" volver="/config" accion={<BotonNuevo href="/config/tipos-activo/nuevo" texto="Nuevo" />} />
      <ListaConfig
        base="/config/tipos-activo"
        vacio="Sin tipos de activo."
        items={tipos.map((t) => ({ id: t.id, titulo: t.nombre, detalle: COMPORTAMIENTOS[t.comportamiento], archivado: t.archivado }))}
      />
    </section>
  );
}
