import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { BadgeEstadoCuota } from "@/components/pasivos/estado-cuota";
import { Monto } from "@/components/ocultar-montos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CERO } from "@/domain/decimal";
import { formatTasa } from "@/lib/dinero";
import { FRECUENCIAS, formatFechaMedia } from "@/lib/etiquetas";
import { listarPasivos } from "@/server/consultas/pasivos";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Pasivos" };

export default async function PasivosPage({ searchParams }: { searchParams: Promise<{ archivados?: string }> }) {
  await requireSession();
  const verArchivados = (await searchParams).archivados === "1";
  const pasivos = await listarPasivos(verArchivados);
  const vigentes = pasivos.filter((p) => p.estado === "VIGENTE" || p.estado === "EN_PREAVISO");
  const totales = (["USD", "ARS"] as const)
    .map((m) => ({
      moneda: m,
      total: vigentes.filter((p) => p.moneda === m).reduce((s, p) => s.add(p.capitalPendiente), CERO),
    }))
    .filter((t) => t.total.gt(0));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pasivos</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/pasivos/calendario">
              <CalendarDays /> Calendario
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/pasivos/nuevo">
              <Plus /> Nuevo
            </Link>
          </Button>
        </div>
      </div>

      {totales.length > 0 && (
        <Card className="gap-1">
          <p className="text-muted-foreground text-sm">Capital que debés</p>
          {totales.map((t) => (
            <Monto key={t.moneda} valor={t.total.toString()} moneda={t.moneda} className="text-2xl font-semibold tracking-tight" />
          ))}
        </Card>
      )}

      {pasivos.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
          <p>Todavía no cargaste pasivos. Empezá por tus mutuos con inversores.</p>
          <Button asChild>
            <Link href="/pasivos/nuevo">Cargá tu primer mutuo</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pasivos.map((p) => (
            <li key={p.id}>
              <Link href={`/pasivos/${p.id}`} className={`bg-card flex flex-col gap-2 rounded-xl border p-4 ${p.estado === "ARCHIVADO" || p.estado === "CANCELADO" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.inversor ?? p.nombre}</p>
                    {p.inversor && p.inversor !== p.nombre && <p className="text-muted-foreground truncate text-sm">{p.nombre}</p>}
                  </div>
                  <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <Monto valor={p.capitalPendiente} moneda={p.moneda} className="text-lg font-semibold" />
                  <span className="text-muted-foreground text-sm">
                    {formatTasa(p.tasaMensual)} mensual · {FRECUENCIAS[p.frecuenciaPago]}
                  </span>
                </div>
                {p.proxima && (
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
                    Próximo: {formatFechaMedia(p.proxima.fechaVencimiento)} ·{" "}
                    <Monto valor={p.proxima.pendiente} moneda={p.moneda} className="text-foreground" />
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {p.instrumentacion === "SOCIEDAD" && <Badge variant="aviso">Sociedad</Badge>}
                  {p.estado === "EN_PREAVISO" && <Badge variant="aviso">En preaviso</Badge>}
                  {p.estado === "CANCELADO" && <Badge variant="positivo">Cancelado</Badge>}
                  {p.estado === "ARCHIVADO" && <Badge>Archivado</Badge>}
                  {p.vencidas > 0 && <BadgeEstadoCuota estado="VENCIDA" />}
                  {p.vencidas > 1 && <span className="text-negativo text-xs">{p.vencidas} cuotas</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={verArchivados ? "/pasivos" : "/pasivos?archivados=1"} className="text-muted-foreground text-center text-sm underline">
        {verArchivados ? "Ocultar archivados" : "Ver archivados"}
      </Link>
    </section>
  );
}
