import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { Monto } from "@/components/ocultar-montos";
import { BadgeEstadoCuota } from "@/components/pasivos/estado-cuota";
import { CERO, Decimal } from "@/domain/decimal";
import { formatFecha, parseFecha, periodoDe, sumarMeses } from "@/domain/fechas";
import type { Moneda } from "@/domain/fx";
import { formatFechaMedia, formatPeriodoLargo } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import { vencimientosPasivos } from "@/server/consultas/pasivos";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Calendario de vencimientos" };

type Vencimiento = Awaited<ReturnType<typeof vencimientosPasivos>>[number];

export default async function CalendarioPage() {
  await requireSession();
  const fechaHoy = hoy();
  const { anio, mes } = parseFecha(fechaHoy);
  const fin = sumarMeses(anio, mes, 12);
  const hasta = formatFecha(fin.anio, fin.mes, 1);
  const vencimientos = await vencimientosPasivos(hasta);

  const vencidas = vencimientos.filter((v) => v.estado === "VENCIDA");
  const porMes = new Map<string, Vencimiento[]>();
  for (const v of vencimientos.filter((x) => x.estado !== "VENCIDA")) {
    const clave = periodoDe(v.fechaVencimiento);
    porMes.set(clave, [...(porMes.get(clave) ?? []), v]);
  }

  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Vencimientos" volver="/pasivos" />
      <p className="text-muted-foreground text-sm">Pagos a inversores pendientes de los próximos 12 meses.</p>

      {vencimientos.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No tenés pagos pendientes en los próximos 12 meses.
        </p>
      )}

      {vencidas.length > 0 && <Grupo titulo="Vencidas" items={vencidas} destacado />}
      {[...porMes.entries()].map(([periodo, items]) => (
        <Grupo key={periodo} titulo={formatPeriodoLargo(periodo)} items={items} />
      ))}
    </section>
  );
}

function Grupo({ titulo, items, destacado }: { titulo: string; items: Vencimiento[]; destacado?: boolean }) {
  const totales = (["USD", "ARS"] as Moneda[])
    .map((m) => ({ moneda: m, total: items.filter((i) => i.moneda === m).reduce((s, i) => s.add(i.pendiente), CERO) }))
    .filter((t) => t.total.gt(0));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={destacado ? "text-negativo font-semibold" : "font-semibold"}>{titulo}</h2>
        <span className="text-muted-foreground flex flex-col items-end text-sm">
          {totales.map((t) => (
            <Monto key={t.moneda} valor={t.total.toString()} moneda={t.moneda} />
          ))}
        </span>
      </div>
      <ul className="bg-card divide-y rounded-xl border">
        {items.map((v) => (
          <li key={v.id}>
            <Link href={`/pasivos/${v.pasivoId}`} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.inversor ?? v.pasivo}</p>
                <p className="text-muted-foreground text-xs">
                  {formatFechaMedia(v.fechaVencimiento)} · {new Decimal(v.capital).gt(0) ? "Capital" : "Interés"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Monto valor={v.pendiente} moneda={v.moneda} className="text-sm font-medium" />
                {v.estado !== "PENDIENTE" && <BadgeEstadoCuota estado={v.estado} />}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
