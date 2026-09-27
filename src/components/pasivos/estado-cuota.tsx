import { Badge } from "@/components/ui/badge";
import type { EstadoCuota } from "@/domain/cuotas";
import { ESTADOS_CUOTA } from "@/lib/etiquetas";

const VARIANTE = { PENDIENTE: "outline", PARCIAL: "aviso", PAGADA: "positivo", VENCIDA: "negativo" } as const;

export function BadgeEstadoCuota({ estado, textoPagada }: { estado: EstadoCuota; textoPagada?: string }) {
  return <Badge variant={VARIANTE[estado]}>{estado === "PAGADA" && textoPagada ? textoPagada : ESTADOS_CUOTA[estado]}</Badge>;
}
