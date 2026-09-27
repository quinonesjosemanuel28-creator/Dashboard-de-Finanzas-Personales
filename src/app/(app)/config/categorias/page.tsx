import type { Metadata } from "next";
import { BotonNuevo } from "@/components/config/boton-nuevo";
import { ListaConfig } from "@/components/config/lista-config";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { GRUPOS_ER } from "@/lib/etiquetas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  await requireSession();
  const categorias = await db.categoria.findMany({ orderBy: [{ tipo: "desc" }, { grupoER: "asc" }, { nombre: "asc" }] });
  const grupos = [
    { titulo: "Ingresos", items: categorias.filter((c) => c.tipo === "INGRESO") },
    { titulo: "Gastos", items: categorias.filter((c) => c.tipo === "GASTO") },
  ];
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Categorías" volver="/config" accion={<BotonNuevo href="/config/categorias/nueva" texto="Nueva" />} />
      {grupos.map((g) => (
        <div key={g.titulo} className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">{g.titulo}</h2>
          <ListaConfig
            base="/config/categorias"
            vacio="Sin categorías."
            items={g.items.map((c) => ({ id: c.id, titulo: c.nombre, detalle: GRUPOS_ER[c.grupoER], archivado: c.archivada }))}
          />
        </div>
      ))}
    </section>
  );
}
