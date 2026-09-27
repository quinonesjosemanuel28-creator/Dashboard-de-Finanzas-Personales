"use client";

import { useActionState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_CONTRAPARTE } from "@/lib/etiquetas";
import { guardarContraparte } from "@/server/acciones/config";

export interface ContraparteForm {
  id?: string;
  nombre: string;
  tipo: string;
  telefono: string;
  email: string;
  notas: string;
}

export function FormContraparte({ contraparte }: { contraparte: ContraparteForm }) {
  const [estado, accion] = useActionState(guardarContraparte, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={contraparte.id ?? ""} />
      <Campo nombre="nombre" etiqueta="Nombre" error={errorDe(estado, "nombre")}>
        <Input id="nombre" name="nombre" defaultValue={contraparte.nombre} required />
      </Campo>
      <Campo nombre="tipo" etiqueta="Tipo">
        <NativeSelect id="tipo" name="tipo" defaultValue={contraparte.tipo}>
          {Object.entries(TIPOS_CONTRAPARTE).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo nombre="telefono" etiqueta="Teléfono (opcional)">
        <Input id="telefono" name="telefono" type="tel" defaultValue={contraparte.telefono} />
      </Campo>
      <Campo nombre="email" etiqueta="Email (opcional)" error={errorDe(estado, "email")}>
        <Input id="email" name="email" type="email" defaultValue={contraparte.email} />
      </Campo>
      <Campo nombre="notas" etiqueta="Notas (opcional)">
        <Textarea id="notas" name="notas" defaultValue={contraparte.notas} />
      </Campo>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar contraparte</BotonEnviar>
    </form>
  );
}
