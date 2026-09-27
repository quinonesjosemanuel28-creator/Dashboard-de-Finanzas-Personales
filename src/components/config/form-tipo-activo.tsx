"use client";

import { useActionState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPORTAMIENTOS } from "@/lib/etiquetas";
import { guardarTipoActivo } from "@/server/acciones/config";

export function FormTipoActivo({
  tipo,
  bloqueado,
}: {
  tipo: { id?: string; nombre: string; comportamiento: string };
  bloqueado?: boolean;
}) {
  const [estado, accion] = useActionState(guardarTipoActivo, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={tipo.id ?? ""} />
      <Campo nombre="nombre" etiqueta="Nombre" error={errorDe(estado, "nombre")}>
        <Input id="nombre" name="nombre" defaultValue={tipo.nombre} required />
      </Campo>
      <Campo
        nombre="comportamiento"
        etiqueta="Comportamiento"
        ayuda={bloqueado ? "No se puede cambiar: ya hay activos de este tipo." : "Define cómo se registra y se valúa el activo."}
      >
        {bloqueado && <input type="hidden" name="comportamiento" value={tipo.comportamiento} />}
        <NativeSelect id="comportamiento" name={bloqueado ? undefined : "comportamiento"} defaultValue={tipo.comportamiento} disabled={bloqueado}>
          {Object.entries(COMPORTAMIENTOS).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </NativeSelect>
      </Campo>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar tipo de activo</BotonEnviar>
    </form>
  );
}
