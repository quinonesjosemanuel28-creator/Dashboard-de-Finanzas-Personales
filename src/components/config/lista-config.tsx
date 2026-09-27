import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ItemLista {
  id: string;
  titulo: string;
  detalle?: React.ReactNode;
  archivado?: boolean;
}

/** Lista de ítems de configuración, con los archivados al final. */
export function ListaConfig({ items, base, vacio }: { items: ItemLista[]; base: string; vacio: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">{vacio}</p>;
  }
  const ordenados = [...items].sort((a, b) => Number(a.archivado ?? false) - Number(b.archivado ?? false));
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {ordenados.map((i) => (
        <li key={i.id}>
          <Link href={`${base}/${i.id}`} className={`flex items-center gap-3 p-4 ${i.archivado ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.titulo}</p>
              {i.detalle && <div className="text-muted-foreground text-sm">{i.detalle}</div>}
            </div>
            {i.archivado && <Badge>Archivado</Badge>}
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
