"use client";

import { useActionState, useState } from "react";
import { AvisoResultado, BotonEnviar } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ResultadoAccion } from "@/server/validacion";

type Accion = (previo: ResultadoAccion | null, form: FormData) => Promise<ResultadoAccion>;

/** Botón que abre una hoja inferior con un formulario; se cierra al guardar bien. */
export function HojaFormulario({
  disparador,
  titulo,
  descripcion,
  accion,
  ocultos,
  textoEnviar,
  variante = "outline",
  children,
}: {
  disparador: string;
  titulo: string;
  descripcion?: string;
  accion: Accion;
  ocultos: Record<string, string>;
  textoEnviar: string;
  variante?: "default" | "outline" | "secondary";
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar] = useActionState(async (previo: ResultadoAccion | null, form: FormData) => {
    const r = await accion(previo, form);
    if (r.ok) setAbierto(false);
    return r;
  }, null);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant={variante} className="w-full">
          {disparador}
        </Button>
      </SheetTrigger>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetTitle>{titulo}</SheetTitle>
        {descripcion && <SheetDescription>{descripcion}</SheetDescription>}
        <form action={enviar} className="flex flex-col gap-4">
          {Object.entries(ocultos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children}
          <AvisoResultado estado={estado && !estado.ok ? estado : null} />
          <BotonEnviar>{textoEnviar}</BotonEnviar>
        </form>
      </SheetContent>
    </Sheet>
  );
}
