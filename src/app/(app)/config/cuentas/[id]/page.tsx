import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { FormCuenta } from "@/components/config/form-cuenta";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { formatNumero } from "@/lib/dinero";
import { archivarCuenta } from "@/server/acciones/config";
import { db } from "@/server/db";
import { deFechaDb } from "@/server/fechas-db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Editar cuenta" };

export default async function EditarCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await db.cuenta.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={c.nombre} volver="/config/cuentas" />
      <FormCuenta
        cuenta={{
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          moneda: c.moneda,
          saldoInicial: formatNumero(c.saldoInicial.toString()),
          fechaSaldoInicial: deFechaDb(c.fechaSaldoInicial),
        }}
      />
      <BotonArchivar archivado={c.archivada} accion={archivarCuenta.bind(null, c.id)} cosa="esta cuenta" />
    </section>
  );
}
