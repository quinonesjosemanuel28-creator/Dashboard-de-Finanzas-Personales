import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { FormTipoActivo } from "@/components/config/form-tipo-activo";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { archivarTipoActivo } from "@/server/acciones/config";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Editar tipo de activo" };

export default async function EditarTipoActivoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const t = await db.tipoActivo.findUnique({ where: { id }, include: { _count: { select: { activos: true } } } });
  if (!t) notFound();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={t.nombre} volver="/config/tipos-activo" />
      <FormTipoActivo tipo={{ id: t.id, nombre: t.nombre, comportamiento: t.comportamiento }} bloqueado={t._count.activos > 0} />
      <BotonArchivar archivado={t.archivado} accion={archivarTipoActivo.bind(null, t.id)} cosa="este tipo de activo" />
    </section>
  );
}
