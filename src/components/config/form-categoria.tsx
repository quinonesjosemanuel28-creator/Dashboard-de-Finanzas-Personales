"use client";

import { useActionState, useState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { GRUPOS_ER, TIPOS_CATEGORIA } from "@/lib/etiquetas";
import { guardarCategoria } from "@/server/acciones/config";

export interface CategoriaForm {
  id?: string;
  nombre: string;
  tipo: "INGRESO" | "GASTO";
  grupoER: string;
}

const GRUPOS_POR_TIPO = {
  INGRESO: ["INGRESO_PERSONAL", "OTRO"],
  GASTO: ["GASTO_FIJO", "GASTO_VARIABLE", "COSTO_FINANCIERO_OTRO", "OTRO"],
} as const;

export function FormCategoria({ categoria }: { categoria: CategoriaForm }) {
  const [estado, accion] = useActionState(guardarCategoria, null);
  const [tipo, setTipo] = useState(categoria.tipo);
  const grupos = GRUPOS_POR_TIPO[tipo];
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={categoria.id ?? ""} />
      <Campo nombre="nombre" etiqueta="Nombre" error={errorDe(estado, "nombre")}>
        <Input id="nombre" name="nombre" defaultValue={categoria.nombre} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo nombre="tipo" etiqueta="Tipo">
          <NativeSelect id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "INGRESO" | "GASTO")}>
            {Object.entries(TIPOS_CATEGORIA).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </NativeSelect>
        </Campo>
        <Campo nombre="grupoER" etiqueta="Grupo en resultados" error={errorDe(estado, "grupoER")}>
          <NativeSelect
            key={tipo}
            id="grupoER"
            name="grupoER"
            defaultValue={(grupos as readonly string[]).includes(categoria.grupoER) ? categoria.grupoER : grupos[0]}
          >
            {grupos.map((g) => (
              <option key={g} value={g}>{GRUPOS_ER[g]}</option>
            ))}
          </NativeSelect>
        </Campo>
      </div>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar categoría</BotonEnviar>
    </form>
  );
}
