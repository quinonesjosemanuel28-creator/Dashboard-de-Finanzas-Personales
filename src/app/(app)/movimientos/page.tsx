import type { Metadata } from "next";
import Link from "next/link";
import { Filter } from "lucide-react";
import { Monto } from "@/components/ocultar-montos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SIGNO_CUENTA } from "@/domain/movimientos";
import { periodoDe } from "@/domain/fechas";
import { TIPOS_MOVIMIENTO, formatFechaMedia } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import { cn } from "@/lib/utils";
import { type FiltrosMovimientos, listarMovimientos, opcionesFiltros } from "@/server/consultas/movimientos";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<FiltrosMovimientos> }) {
  await requireSession();
  const params = await searchParams;
  const filtros: FiltrosMovimientos = { ...params, mes: params.mes ?? periodoDe(hoy()) };
  const [movimientos, opciones] = await Promise.all([listarMovimientos(filtros), opcionesFiltros()]);
  const activos = Object.entries(params).filter(([k, v]) => k !== "mes" && v).length;

  const porFecha = new Map<string, typeof movimientos>();
  for (const m of movimientos) porFecha.set(m.fecha, [...(porFecha.get(m.fecha) ?? []), m]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>

      <form className="flex flex-col gap-2" method="get">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input type="month" name="mes" defaultValue={filtros.mes} aria-label="Mes" />
          <Button type="submit" variant="outline">Ver</Button>
        </div>
        <details className="bg-card rounded-xl border px-4 py-3" open={activos > 0}>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Filter className="size-4" /> Filtros{activos > 0 ? ` (${activos})` : ""}
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input name="q" defaultValue={params.q} placeholder="Buscar en la descripción" className="col-span-2" />
            <NativeSelect name="tipo" defaultValue={params.tipo ?? ""} aria-label="Tipo">
              <option value="">Todos los tipos</option>
              {Object.entries(TIPOS_MOVIMIENTO).map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </NativeSelect>
            <NativeSelect name="moneda" defaultValue={params.moneda ?? ""} aria-label="Moneda">
              <option value="">ARS y USD</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </NativeSelect>
            <NativeSelect name="cuentaId" defaultValue={params.cuentaId ?? ""} aria-label="Cuenta">
              <option value="">Todas las cuentas</option>
              {opciones.cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
              ))}
            </NativeSelect>
            <NativeSelect name="categoriaId" defaultValue={params.categoriaId ?? ""} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {opciones.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </NativeSelect>
            <NativeSelect name="activoId" defaultValue={params.activoId ?? ""} aria-label="Activo">
              <option value="">Todos los activos</option>
              {opciones.activos.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </NativeSelect>
            <NativeSelect name="pasivoId" defaultValue={params.pasivoId ?? ""} aria-label="Pasivo">
              <option value="">Todos los pasivos</option>
              {opciones.pasivos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </NativeSelect>
            <Button type="submit" className="col-span-2">Aplicar filtros</Button>
            {activos > 0 && (
              <Link href={`/movimientos?mes=${filtros.mes}`} className="text-muted-foreground col-span-2 text-center text-sm underline">
                Limpiar filtros
              </Link>
            )}
          </div>
        </details>
      </form>

      {movimientos.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No hay movimientos con estos filtros. Cargá uno con el botón +.
        </p>
      ) : (
        [...porFecha.entries()].map(([fecha, items]) => (
          <div key={fecha} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">{formatFechaMedia(fecha)}</h2>
            <ul className="bg-card divide-y rounded-xl border">
              {items.map((m) => {
                const signo = SIGNO_CUENTA[m.tipo];
                const negativo = m.tipo === "AJUSTE" ? m.monto.startsWith("-") : signo < 0;
                return (
                  <li key={m.id}>
                    <Link href={`/movimientos/${m.id}`} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{titulo(m)}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {TIPOS_MOVIMIENTO[m.tipo]}
                          {m.cuenta ? ` · ${m.cuenta}` : ""}
                          {m.cuentaDestino ? ` → ${m.cuentaDestino}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <Monto
                          valor={m.tipo === "AJUSTE" ? m.monto.replace("-", "") : m.monto}
                          moneda={m.moneda}
                          className={cn("text-sm font-medium", m.tipo === "TRANSFERENCIA" || m.tipo === "BAJA_INCOBRABLE" ? "" : negativo ? "text-negativo" : "text-positivo")}
                        />
                        {m.montoDestino && m.monedaDestino && (
                          <Monto valor={m.montoDestino} moneda={m.monedaDestino} className="text-muted-foreground text-xs" />
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function titulo(m: Awaited<ReturnType<typeof listarMovimientos>>[number]): string {
  return m.descripcion ?? m.categoria ?? m.activo ?? m.pasivo ?? (m.tipo === "TRANSFERENCIA" ? "Transferencia" : "Movimiento");
}
