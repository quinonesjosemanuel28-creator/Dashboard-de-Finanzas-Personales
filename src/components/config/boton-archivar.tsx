"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Archiva o restaura (nunca borra: regla 9). */
export function BotonArchivar({
  archivado,
  accion,
  cosa,
}: {
  archivado: boolean;
  accion: (archivar: boolean) => Promise<void>;
  cosa: string;
}) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={pendiente}
      onClick={() => {
        if (!archivado && !window.confirm(`¿Archivás ${cosa}? Deja de aparecer en las listas, pero conserva su historia.`)) return;
        iniciar(() => accion(!archivado));
      }}
    >
      {archivado ? <ArchiveRestore /> : <Archive />}
      {archivado ? "Restaurar" : "Archivar"}
    </Button>
  );
}
