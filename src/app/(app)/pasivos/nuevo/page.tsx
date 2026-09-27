import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { AltaPasivo } from "@/components/pasivos/alta-pasivo";
import { hoy } from "@/lib/hoy";
import { cuentasActivas } from "@/server/consultas/cuentas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nuevo pasivo" };

export default async function NuevoPasivoPage() {
  await requireSession();
  const [inversores, cuentas] = await Promise.all([
    db.contraparte.findMany({
      where: { tipo: { in: ["INVERSOR", "AMBOS", "OTRO"] } },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    cuentasActivas(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nuevo pasivo" volver="/pasivos" />
      <AltaPasivo inversores={inversores} cuentas={cuentas} hoy={hoy()} />
    </section>
  );
}
