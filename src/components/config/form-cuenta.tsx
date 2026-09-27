"use client";

import { useActionState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MONEDAS, TIPOS_CUENTA } from "@/lib/etiquetas";
import { guardarCuenta } from "@/server/acciones/config";

export interface CuentaForm {
  id?: string;
  nombre: string;
  tipo: string;
  moneda: string;
  saldoInicial: string;
  fechaSaldoInicial: string;
}

export function FormCuenta({ cuenta }: { cuenta: CuentaForm }) {
  const [estado, accion] = useActionState(guardarCuenta, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={cuenta.id ?? ""} />
      <Campo nombre="nombre" etiqueta="Nombre" error={errorDe(estado, "nombre")}>
        <Input id="nombre" name="nombre" defaultValue={cuenta.nombre} placeholder="Ej.: Galicia pesos" required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo nombre="tipo" etiqueta="Tipo">
          <NativeSelect id="tipo" name="tipo" defaultValue={cuenta.tipo}>
            {Object.entries(TIPOS_CUENTA).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </NativeSelect>
        </Campo>
        <Campo nombre="moneda" etiqueta="Moneda">
          <NativeSelect id="moneda" name="moneda" defaultValue={cuenta.moneda}>
            {MONEDAS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </NativeSelect>
        </Campo>
      </div>
      <Campo nombre="saldoInicial" etiqueta="Saldo inicial" error={errorDe(estado, "saldoInicial")} ayuda="En la moneda de la cuenta. Ej.: 1.250.000,50">
        <Input id="saldoInicial" name="saldoInicial" inputMode="decimal" defaultValue={cuenta.saldoInicial} required />
      </Campo>
      <Campo nombre="fechaSaldoInicial" etiqueta="Fecha del saldo inicial" error={errorDe(estado, "fechaSaldoInicial")}>
        <Input id="fechaSaldoInicial" name="fechaSaldoInicial" type="date" defaultValue={cuenta.fechaSaldoInicial} required />
      </Campo>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar cuenta</BotonEnviar>
    </form>
  );
}
