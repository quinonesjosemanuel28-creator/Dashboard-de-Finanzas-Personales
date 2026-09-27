import type { Metadata } from "next";
import { BotonNuevo } from "@/components/config/boton-nuevo";
import { ListaConfig } from "@/components/config/lista-config";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { Monto } from "@/components/ocultar-montos";
import { TIPOS_CUENTA } from "@/lib/etiquetas";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Cuentas" };

export default async function CuentasPage() {
  await requireSession();
  const cuentas = await db.cuenta.findMany({ orderBy: [{ moneda: "asc" }, { nombre: "asc" }] });
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Cuentas" volver="/config" accion={<BotonNuevo href="/config/cuentas/nueva" texto="Nueva" />} />
      <ListaConfig
        base="/config/cuentas"
        vacio="Todavía no tenés cuentas. Cargá dónde tenés la plata líquida: efectivo, bancos, billeteras."
        items={cuentas.map((c) => ({
          id: c.id,
          titulo: c.nombre,
          archivado: c.archivada,
          detalle: (
            <>
              {TIPOS_CUENTA[c.tipo]} · Saldo inicial <Monto valor={c.saldoInicial.toString()} moneda={c.moneda} />
            </>
          ),
        }))}
      />
    </section>
  );
}
