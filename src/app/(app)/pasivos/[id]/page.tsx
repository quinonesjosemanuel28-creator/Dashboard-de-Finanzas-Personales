import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { Monto } from "@/components/ocultar-montos";
import { BadgeEstadoCuota } from "@/components/pasivos/estado-cuota";
import { PagarCuota } from "@/components/pasivos/pagar-cuota";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Decimal, redondear2 } from "@/domain/decimal";
import { formatTasa } from "@/lib/dinero";
import { ESQUEMAS, ESTADOS_PASIVO, FRECUENCIAS, TIPOS_PASIVO, formatFechaMedia } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import { archivarPasivo } from "@/server/acciones/pasivos";
import { cuentaPorDefecto, cuentasActivas } from "@/server/consultas/cuentas";
import { obtenerPasivo } from "@/server/consultas/pasivos";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Pasivo" };

const TIPOS_MOV: Record<string, string> = {
  TOMA_PASIVO: "Ingreso de capital",
  PAGO_INTERES: "Pago de interés",
  PAGO_CAPITAL: "Devolución de capital",
};

export default async function PasivoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const p = await obtenerPasivo(id);
  if (!p) notFound();
  const [cuentas, cuentaDefecto] = await Promise.all([cuentasActivas(p.moneda), cuentaPorDefecto(p.moneda)]);
  const fechaHoy = hoy();
  const archivado = p.estado === "ARCHIVADO";
  const interesMensual = redondear2(new Decimal(p.capital).mul(p.tasaMensual)).toString();

  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={p.inversor ?? p.nombre} volver="/pasivos" />

      <Card className="gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Capital pendiente</p>
          <Monto valor={p.capitalPendiente} moneda={p.moneda} className="text-3xl font-semibold tracking-tight" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{ESTADOS_PASIVO[p.estado]}</Badge>
          <Badge variant="outline">{TIPOS_PASIVO[p.tipo]}</Badge>
          {p.instrumentacion === "SOCIEDAD" && (
            <Badge variant="aviso">Sociedad{p.regularizacion === "PENDIENTE" ? " · a regularizar" : ""}</Badge>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Dato etiqueta="Tasa">{formatTasa(p.tasaMensual)} mensual</Dato>
          <Dato etiqueta="Interés por mes"><Monto valor={interesMensual} moneda={p.moneda} /></Dato>
          <Dato etiqueta="Paga">{FRECUENCIAS[p.frecuenciaPago]}, día {p.diaPago}</Dato>
          <Dato etiqueta="Plazo">{p.plazoMeses} meses</Dato>
          <Dato etiqueta="Inicio">{formatFechaMedia(p.fechaInicio)}</Dato>
          <Dato etiqueta="Vencimiento">{formatFechaMedia(p.fechaVencimiento)}</Dato>
          <Dato etiqueta="Capital original"><Monto valor={p.capital} moneda={p.moneda} /></Dato>
          <Dato etiqueta="Esquema">{ESQUEMAS[p.esquema]}</Dato>
        </dl>
        {p.notas && <p className="text-muted-foreground text-sm whitespace-pre-line">{p.notas}</p>}
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Cronograma</h2>
        <ul className="bg-card divide-y rounded-xl border">
          {p.cuotas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {formatFechaMedia(c.fechaVencimiento)}
                  <span className="text-muted-foreground font-normal">
                    {" "}· #{c.numero}
                    {c.mesesCubiertos === 0 ? " · capital" : c.mesesCubiertos > 1 ? ` · ${c.mesesCubiertos} meses` : ""}
                  </span>
                </p>
                <p className="text-sm">
                  <Monto valor={new Decimal(c.interes).add(c.capital).toString()} moneda={p.moneda} />
                  {c.estado === "PARCIAL" || (c.estado === "VENCIDA" && new Decimal(c.montoPagado).gt(0)) ? (
                    <span className="text-muted-foreground"> · falta <Monto valor={c.pendiente} moneda={p.moneda} /></span>
                  ) : null}
                </p>
                {c.punitorio && (
                  <p className="text-negativo text-xs">
                    Punitorio estimado <Monto valor={c.punitorio} moneda={p.moneda} />
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <BadgeEstadoCuota estado={c.estado} />
                {c.estado !== "PAGADA" && !archivado && (
                  <PagarCuota cuota={c} moneda={p.moneda} cuentas={cuentas} cuentaPorDefecto={cuentaDefecto} hoy={fechaHoy} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {p.movimientos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Movimientos</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {p.movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{TIPOS_MOV[m.tipo] ?? m.tipo}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatFechaMedia(m.fecha)}
                    {m.cuenta ? ` · ${m.cuenta}` : ""}
                  </p>
                </div>
                <Monto valor={m.monto} moneda={p.moneda} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <BotonArchivar archivado={archivado} accion={archivarPasivo.bind(null, p.id)} cosa="este pasivo" />
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}
