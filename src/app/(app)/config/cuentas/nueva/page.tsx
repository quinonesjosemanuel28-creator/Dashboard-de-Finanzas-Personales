import type { Metadata } from "next";
import { FormCuenta } from "@/components/config/form-cuenta";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { hoy } from "@/lib/hoy";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Nueva cuenta" };

export default async function NuevaCuentaPage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nueva cuenta" volver="/config/cuentas" />
      <FormCuenta cuenta={{ nombre: "", tipo: "BANCO", moneda: "ARS", saldoInicial: "0", fechaSaldoInicial: hoy() }} />
    </section>
  );
}
