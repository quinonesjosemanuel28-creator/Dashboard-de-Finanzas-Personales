"use client";

import { useActionState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { guardarTcManual } from "@/server/acciones/config";

export function FormTc({ fecha }: { fecha: string }) {
  const [estado, accion] = useActionState(guardarTcManual, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo nombre="fecha" etiqueta="Fecha" error={errorDe(estado, "fecha")}>
        <Input id="fecha" name="fecha" type="date" defaultValue={fecha} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo nombre="compra" etiqueta="Compra (ARS)" error={errorDe(estado, "compra")}>
          <Input id="compra" name="compra" inputMode="decimal" placeholder="1.495,00" required />
        </Campo>
        <Campo nombre="venta" etiqueta="Venta (ARS)" error={errorDe(estado, "venta")}>
          <Input id="venta" name="venta" inputMode="decimal" placeholder="1.545,00" required />
        </Campo>
      </div>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar TC manual</BotonEnviar>
    </form>
  );
}
