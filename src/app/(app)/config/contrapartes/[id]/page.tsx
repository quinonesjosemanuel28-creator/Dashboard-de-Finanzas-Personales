import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormContraparte } from "@/components/config/form-contraparte";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Editar contraparte" };

export default async function EditarContrapartePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await db.contraparte.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={c.nombre} volver="/config/contrapartes" />
      <FormContraparte
        contraparte={{ id: c.id, nombre: c.nombre, tipo: c.tipo, telefono: c.telefono ?? "", email: c.email ?? "", notas: c.notas ?? "" }}
      />
    </section>
  );
}
