"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Moneda } from "@/domain/fx";
import { cn } from "@/lib/utils";
import type { CuotaEditable } from "./cuotas-editables";

/** Lista de cuotas editables: fecha, interés y capital de cada una. */
export function EditorCuotas({
  cuotas,
  moneda,
  onEditar,
  marcada,
  textoMarcada = "Pagada",
}: {
  cuotas: CuotaEditable[];
  moneda: Moneda;
  onEditar: (i: number, campo: "fechaVencimiento" | "interes" | "capital", valor: string) => void;
  marcada?: (c: CuotaEditable) => boolean;
  textoMarcada?: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {cuotas.map((c, i) => {
        const esMarcada = marcada?.(c) ?? false;
        return (
          <li key={c.numero} className={cn("bg-card flex flex-col gap-2 rounded-xl border p-3", esMarcada && "opacity-70")}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Cuota {c.numero}
                {c.mesesCubiertos === 0 ? " · Capital" : c.mesesCubiertos > 1 ? ` · ${c.mesesCubiertos} meses` : ""}
              </span>
              {esMarcada && (
                <Badge variant="positivo">
                  <Check className="size-3" /> {textoMarcada}
                </Badge>
              )}
            </div>
            <Input
              type="date"
              aria-label={`Fecha de la cuota ${c.numero}`}
              value={c.fechaVencimiento}
              onChange={(e) => onEditar(i, "fechaVencimiento", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Interés ({moneda})</span>
                <Input inputMode="decimal" value={c.interes} onChange={(e) => onEditar(i, "interes", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Capital ({moneda})</span>
                <Input inputMode="decimal" value={c.capital} onChange={(e) => onEditar(i, "capital", e.target.value)} />
              </label>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
