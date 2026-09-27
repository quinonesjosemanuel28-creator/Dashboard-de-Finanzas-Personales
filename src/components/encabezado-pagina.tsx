import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function EncabezadoPagina({
  titulo,
  volver,
  accion,
}: {
  titulo: string;
  volver?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {volver && (
          <Link href={volver} aria-label="Volver" className="text-muted-foreground -ml-2 p-2">
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{titulo}</h1>
      </div>
      {accion}
    </div>
  );
}
