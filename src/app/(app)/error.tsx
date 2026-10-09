"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportarErrorCliente } from "@/server/acciones/errores";

/**
 * Error boundary de las pantallas de la app. Los errores del servidor ya
 * quedan en el log con su digest (instrumentation.ts); los del navegador se
 * envían al servidor para registrarlos, saneados.
 */
export default function ErrorApp({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (!error.digest) {
      reportarErrorCliente({ nombre: error.name, mensaje: error.message, ruta: window.location.pathname }).catch(() => {});
    }
  }, [error]);

  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center">
      <AlertTriangle className="text-negativo size-8" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">No pudimos cargar esta pantalla</h1>
        <p className="text-muted-foreground text-sm">
          Algo falló de nuestro lado. Probá de nuevo en un rato; si sigue pasando, revisá los logs del servidor.
        </p>
      </div>
      {error.digest && (
        <p className="text-muted-foreground text-xs">
          Código del error: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="flex w-full flex-col gap-2">
        <Button onClick={() => retry()}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </section>
  );
}
