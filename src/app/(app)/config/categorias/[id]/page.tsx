import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { FormCategoria } from "@/components/config/form-categoria";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { archivarCategoria } from "@/server/acciones/config";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Editar categoría" };

export default async function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await db.categoria.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={c.nombre} volver="/config/categorias" />
      <FormCategoria categoria={{ id: c.id, nombre: c.nombre, tipo: c.tipo, grupoER: c.grupoER }} />
      <BotonArchivar archivado={c.archivada} accion={archivarCategoria.bind(null, c.id)} cosa="esta categoría" />
    </section>
  );
}
