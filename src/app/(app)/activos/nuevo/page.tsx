import type { Metadata } from "next";
import { AltaActivo } from "@/components/activos/alta-activo";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import type { Comportamiento } from "@/domain/activos";
import { hoy } from "@/lib/hoy";
import { cuentasActivas } from "@/server/consultas/cuentas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nuevo activo" };

export default async function NuevoActivoPage() {
  await requireSession();
  const [tipos, contrapartes, cuentas] = await Promise.all([
    db.tipoActivo.findMany({ where: { archivado: false }, orderBy: { nombre: "asc" } }),
    db.contraparte.findMany({ where: { tipo: { in: ["DEUDOR", "AMBOS", "OTRO"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    cuentasActivas(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nuevo activo" volver="/activos" />
      <AltaActivo
        tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre, comportamiento: t.comportamiento as Comportamiento }))}
        contrapartes={contrapartes}
        cuentas={cuentas}
        hoy={hoy()}
      />
    </section>
  );
}
