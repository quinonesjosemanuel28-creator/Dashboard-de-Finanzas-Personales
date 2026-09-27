"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ResultadoAccion } from "@/server/validacion";

/** Botón que pide confirmación, ejecuta una server action y muestra el error si falla. */
export function BotonConfirmado({
  accion,
  confirmacion,
  children,
  ...props
}: {
  accion: () => Promise<ResultadoAccion>;
  confirmacion: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        {...props}
        disabled={pendiente || props.disabled}
        onClick={() => {
          if (!window.confirm(confirmacion)) return;
          setError(null);
          iniciar(async () => {
            const r = await accion();
            if (r && !r.ok) setError(r.error);
          });
        }}
      >
        {children}
      </Button>
      {error && (
        <p role="alert" className="text-negativo text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
