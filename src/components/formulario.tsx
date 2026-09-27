"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ResultadoAccion } from "@/server/validacion";

/** Etiqueta + control + error de validación. */
export function Campo({
  nombre,
  etiqueta,
  error,
  ayuda,
  className,
  children,
}: {
  nombre: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={nombre}>{etiqueta}</Label>
      {children}
      {error ? (
        <p className="text-negativo text-sm" id={`${nombre}-error`}>
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-muted-foreground text-xs">{ayuda}</p>
      ) : null}
    </div>
  );
}

export function BotonEnviar({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("w-full", className)} {...props}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

export function AvisoResultado({ estado }: { estado: ResultadoAccion | null }) {
  if (!estado) return null;
  if (estado.ok) {
    return estado.mensaje ? (
      <p role="status" className="bg-positivo/10 text-positivo rounded-md p-3 text-sm">
        {estado.mensaje}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="bg-negativo/10 text-negativo rounded-md p-3 text-sm">
      {estado.error}
    </p>
  );
}

/** Error de un campo del resultado, si lo hay. */
export function errorDe(estado: ResultadoAccion | null, campo: string): string | undefined {
  return estado && !estado.ok ? estado.campos?.[campo] : undefined;
}
