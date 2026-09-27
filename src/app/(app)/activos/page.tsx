import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Monto } from "@/components/ocultar-montos";
import { BadgeEstadoCuota } from "@/components/pasivos/estado-cuota";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CERO } from "@/domain/decimal";
import { formatTasa } from "@/lib/dinero";
import { ESTADOS_ACTIVO, formatFechaMedia } from "@/lib/etiquetas";
import { listarActivos } from "@/server/consultas/activos";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Activos" };

type Activo = Awaited<ReturnType<typeof listarActivos>>[number];

export default async function ActivosPage({ searchParams }: { searchParams: Promise<{ archivados?: string }> }) {
  await requireSession();
  const verArchivados = (await searchParams).archivados === "1";
  const activos = await listarActivos(verArchivados);
  const vigentes = activos.filter((a) => a.estado === "ACTIVO" || a.estado === "EN_MORA");
  const totales = (["USD", "ARS"] as const)
    .map((m) => ({ moneda: m, total: vigentes.filter((a) => a.moneda === m).reduce((s, a) => s.add(a.valor), CERO) }))
    .filter((t) => t.total.gt(0));

  const grupos = new Map<string, Activo[]>();
  for (const a of activos) grupos.set(a.tipo, [...(grupos.get(a.tipo) ?? []), a]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Activos</h1>
        <Button asChild size="sm">
          <Link href="/activos/nuevo">
            <Plus /> Nuevo
          </Link>
        </Button>
      </div>

      {totales.length > 0 && (
        <Card className="gap-1">
          <p className="text-muted-foreground text-sm">Capital en activos productivos</p>
          {totales.map((t) => (
            <Monto key={t.moneda} valor={t.total.toString()} moneda={t.moneda} className="text-2xl font-semibold tracking-tight" />
          ))}
        </Card>
      )}

      {activos.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
          <p>Todavía no cargaste activos: préstamos, carteras, compraventas o tenencias.</p>
          <Button asChild>
            <Link href="/activos/nuevo">Cargá tu primer activo</Link>
          </Button>
        </div>
      ) : (
        [...grupos.entries()].map(([tipo, items]) => (
          <div key={tipo} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">{tipo}</h2>
            <ul className="flex flex-col gap-2">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/activos/${a.id}`}
                    className={`bg-card flex flex-col gap-1.5 rounded-xl border p-4 ${a.estado === "ACTIVO" || a.estado === "EN_MORA" ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{a.nombre}</p>
                      <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <Monto valor={a.valor} moneda={a.moneda} className="text-lg font-semibold" />
                      <span className="text-muted-foreground text-sm">{detalle(a)}</span>
                    </div>
                    {a.proxima && (
                      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
                        Próximo cobro: {formatFechaMedia(a.proxima.fechaVencimiento)} ·{" "}
                        <Monto valor={a.proxima.pendiente} moneda={a.moneda} className="text-foreground" />
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {a.estado !== "ACTIVO" && <Badge variant={a.estado === "INCOBRABLE" ? "negativo" : "default"}>{ESTADOS_ACTIVO[a.estado]}</Badge>}
                      {a.vencidas > 0 && <BadgeEstadoCuota estado="VENCIDA" />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Link href={verArchivados ? "/activos" : "/activos?archivados=1"} className="text-muted-foreground text-center text-sm underline">
        {verArchivados ? "Ocultar archivados" : "Ver archivados"}
      </Link>
    </section>
  );
}

function detalle(a: Activo): string {
  switch (a.comportamiento) {
    case "RENTA_PROGRAMADA":
      return a.tasaMensual ? `${formatTasa(a.tasaMensual)} mensual` : "";
    case "CARTERA":
      return a.rendimientoEsperadoMensual ? `esperado ${formatTasa(a.rendimientoEsperadoMensual)}` : "Cartera";
    case "COMPRAVENTA":
      return a.vendido ? "Vendido" : "En stock";
    case "TENENCIA":
      return a.fechaValuacion ? `valuado ${formatFechaMedia(a.fechaValuacion)}` : "Sin valuar";
  }
}
