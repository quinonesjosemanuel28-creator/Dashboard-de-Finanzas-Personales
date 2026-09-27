import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonConfirmado } from "@/components/boton-confirmado";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { HojaFormulario } from "@/components/hoja-formulario";
import { Monto } from "@/components/ocultar-montos";
import { BadgeEstadoCuota } from "@/components/pasivos/estado-cuota";
import { PagarCuota } from "@/components/pasivos/pagar-cuota";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Decimal } from "@/domain/decimal";
import { periodoDe } from "@/domain/fechas";
import { formatMonto, formatTasa } from "@/lib/dinero";
import { ESTADOS_ACTIVO, FRECUENCIAS, TIPOS_MOVIMIENTO, formatFechaMedia, formatPeriodoLargo } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import {
  actualizarValuacion,
  archivarActivo,
  cobrarCuota,
  deshacerCobro,
  deshacerVenta,
  eliminarActivo,
  marcarIncobrable,
  registrarMesCartera,
  registrarMovimientoActivo,
  registrarVenta,
} from "@/server/acciones/activos";
import { type ActivoDetalle, obtenerActivo } from "@/server/consultas/activos";
import { cuentaPorDefecto, cuentasActivas } from "@/server/consultas/cuentas";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Activo" };

export default async function ActivoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const a = await obtenerActivo(id);
  if (!a) notFound();
  const [cuentas, cuentaDefecto] = await Promise.all([cuentasActivas(a.moneda), cuentaPorDefecto(a.moneda)]);
  const fechaHoy = hoy();
  const operable = a.estado === "ACTIVO" || a.estado === "EN_MORA";
  const ctx = { a, cuentas, cuentaDefecto, fechaHoy };

  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={a.nombre} volver="/activos" />

      <Card className="gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{a.comportamiento === "COMPRAVENTA" && a.fechaVenta ? "Vendido" : "Valor en balance"}</p>
          <Monto valor={a.valor} moneda={a.moneda} className="text-3xl font-semibold tracking-tight" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={a.estado === "INCOBRABLE" ? "negativo" : "default"}>{ESTADOS_ACTIVO[a.estado]}</Badge>
          <Badge variant="outline">{a.tipo}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {a.contraparte && <Dato etiqueta="Contraparte">{a.contraparte}</Dato>}
          <Dato etiqueta={a.comportamiento === "RENTA_PROGRAMADA" ? "Capital prestado" : a.comportamiento === "CARTERA" ? "Capital inicial" : "Costo de compra"}>
            <Monto valor={a.capitalInicial} moneda={a.moneda} />
          </Dato>
          <Dato etiqueta="Desde">{formatFechaMedia(a.fechaInicio)}</Dato>
          {a.comportamiento === "RENTA_PROGRAMADA" && (
            <>
              {a.tasaMensual && <Dato etiqueta="Tasa">{formatTasa(a.tasaMensual)} mensual</Dato>}
              <Dato etiqueta="Cobra">{FRECUENCIAS[a.frecuenciaPago]}, día {a.diaPago}</Dato>
              {a.fechaFin && <Dato etiqueta="Vencimiento">{formatFechaMedia(a.fechaFin)}</Dato>}
            </>
          )}
          {a.comportamiento === "CARTERA" && a.rendimientoEsperadoMensual && (
            <Dato etiqueta="Esperado">{formatTasa(a.rendimientoEsperadoMensual)} mensual</Dato>
          )}
          {a.comportamiento !== "RENTA_PROGRAMADA" && (
            <Dato etiqueta="Rendimiento cobrado"><Monto valor={a.rendimientoCobrado} moneda={a.moneda} /></Dato>
          )}
          {new Decimal(a.gastosDirectos).gt(0) && (
            <Dato etiqueta="Gastos directos"><Monto valor={a.gastosDirectos} moneda={a.moneda} /></Dato>
          )}
          {a.comportamiento === "COMPRAVENTA" && a.costo && <Dato etiqueta="Costo total"><Monto valor={a.costo} moneda={a.moneda} /></Dato>}
          {a.comportamiento === "COMPRAVENTA" && a.precioVenta && a.costo && (
            <>
              <Dato etiqueta="Precio de venta"><Monto valor={a.precioVenta} moneda={a.moneda} /></Dato>
              <Dato etiqueta={new Decimal(a.precioVenta).gte(a.costo) ? "Ganancia" : "Pérdida"}>
                <Monto valor={new Decimal(a.precioVenta).sub(a.costo).abs().toString()} moneda={a.moneda} />
              </Dato>
            </>
          )}
          {a.comportamiento === "TENENCIA" && (
            <Dato etiqueta="Valuación">{a.fechaValuacion ? formatFechaMedia(a.fechaValuacion) : "Sin valuar (se usa el costo)"}</Dato>
          )}
        </dl>
        {a.notas && <p className="text-muted-foreground text-sm whitespace-pre-line">{a.notas}</p>}
      </Card>

      {a.comportamiento === "RENTA_PROGRAMADA" && <Cronograma {...ctx} operable={operable} />}
      {a.comportamiento === "CARTERA" && operable && <AccionesCartera {...ctx} />}
      {a.comportamiento === "CARTERA" && <RegistrosCartera {...ctx} operable={operable} />}
      {a.comportamiento === "COMPRAVENTA" && <AccionesCompraventa {...ctx} operable={operable} />}
      {a.comportamiento === "TENENCIA" && <AccionesTenencia {...ctx} operable={operable} />}

      {(a.comportamiento === "RENTA_PROGRAMADA" || a.comportamiento === "CARTERA") && operable && (
        <BotonConfirmado
          variant="outline"
          className="w-full"
          accion={marcarIncobrable.bind(null, a.id)}
          confirmacion="¿Pasás este activo a incobrable? Se da de baja el capital pendiente y va a Pérdidas del mes."
        >
          Marcar como incobrable
        </BotonConfirmado>
      )}

      {a.movimientos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Movimientos</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {a.movimientos.map((m) => (
              <li key={m.id}>
                <Link href={`/movimientos/${m.id}`} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{TIPOS_MOVIMIENTO[m.tipo]}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {formatFechaMedia(m.fecha)}
                      {m.cuenta ? ` · ${m.cuenta}` : ""}
                      {m.descripcion ? ` · ${m.descripcion}` : ""}
                    </p>
                  </div>
                  <Monto valor={m.monto} moneda={a.moneda} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BotonArchivar archivado={a.estado === "ARCHIVADO"} accion={archivarActivo.bind(null, a.id)} cosa="este activo" />
      {a.eliminacion.permitido ? (
        <BotonConfirmado
          variant="ghost"
          className="text-negativo w-full"
          accion={eliminarActivo.bind(null, a.id)}
          confirmacion="¿Eliminás este activo? Se borra con todo lo cargado y no se puede recuperar. Usalo solo si lo cargaste por error."
        >
          Eliminar (cargado por error)
        </BotonConfirmado>
      ) : (
        <p className="text-muted-foreground text-center text-xs">{a.eliminacion.motivo}</p>
      )}
    </section>
  );
}

interface Ctx {
  a: ActivoDetalle;
  cuentas: { id: string; nombre: string }[];
  cuentaDefecto: string | null;
  fechaHoy: string;
}

function Cronograma({ a, cuentas, cuentaDefecto, fechaHoy, operable }: Ctx & { operable: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Cronograma de cobro</h2>
      <ul className="bg-card divide-y rounded-xl border">
        {a.cuotas.map((c) => (
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
                <Monto valor={new Decimal(c.interes).add(c.capital).toString()} moneda={a.moneda} />
                {c.estado !== "PAGADA" && new Decimal(c.montoPagado).gt(0) && (
                  <span className="text-muted-foreground"> · falta <Monto valor={c.pendiente} moneda={a.moneda} /></span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <BadgeEstadoCuota estado={c.estado} textoPagada="Cobrada" />
              {c.estado !== "PAGADA" && operable && (
                <PagarCuota cuota={c} moneda={a.moneda} cuentas={cuentas} cuentaPorDefecto={cuentaDefecto} hoy={fechaHoy} modo="cobrar" accion={cobrarCuota} />
              )}
              {c.cobrosRegistrados > 0 && a.estado !== "ARCHIVADO" && (
                <BotonConfirmado
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-8 px-2 text-xs"
                  accion={deshacerCobro.bind(null, c.id)}
                  confirmacion={`¿Deshacés el cobro de la cuota ${c.numero}? Se borran sus movimientos y la cuota vuelve a quedar impaga.`}
                >
                  Deshacer cobro
                </BotonConfirmado>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Campos comunes de un movimiento del activo: monto, cuenta, fecha y descripción. */
function CamposMovimiento({ a, cuentas, cuentaDefecto, fechaHoy, etiquetaMonto, etiquetaCuenta = "Cuenta" }: Ctx & { etiquetaMonto: string; etiquetaCuenta?: string }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>{`${etiquetaMonto} (${a.moneda})`}</Label>
        <Input name="monto" inputMode="decimal" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{etiquetaCuenta}</Label>
        {cuentas.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tenés cuentas en {a.moneda}. Creala en Configuración → Cuentas.</p>
        ) : (
          <NativeSelect name="cuentaId" defaultValue={cuentaDefecto ?? cuentas[0]?.id}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </NativeSelect>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Fecha</Label>
          <Input name="fecha" type="date" defaultValue={fechaHoy} max={fechaHoy} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Descripción</Label>
          <Input name="descripcion" placeholder="Opcional" />
        </div>
      </div>
    </>
  );
}

function HojaMovimiento(props: Ctx & { tipo: string; disparador: string; titulo: string; etiquetaMonto: string; etiquetaCuenta?: string; variante?: "default" | "outline" }) {
  return (
    <HojaFormulario
      disparador={props.disparador}
      titulo={props.titulo}
      accion={registrarMovimientoActivo}
      ocultos={{ activoId: props.a.id, tipo: props.tipo }}
      textoEnviar="Guardar"
      variante={props.variante}
    >
      <CamposMovimiento {...props} />
    </HojaFormulario>
  );
}

function AccionesCartera(ctx: Ctx) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <HojaMovimiento {...ctx} tipo="COBRO_RENDIMIENTO" disparador="Registrar ganancia del mes" titulo="Ganancia del mes" etiquetaMonto="Ganancia neta" etiquetaCuenta="Entró en la cuenta" variante="default" />
      </div>
      <HojaMovimiento {...ctx} tipo="APLICACION_ACTIVO" disparador="Aportar capital" titulo="Aporte de capital" etiquetaMonto="Monto aportado" etiquetaCuenta="Salió de la cuenta" />
      <HojaMovimiento {...ctx} tipo="COBRO_CAPITAL" disparador="Retirar capital" titulo="Retiro de capital" etiquetaMonto="Monto retirado" etiquetaCuenta="Entró en la cuenta" />
      <div className="col-span-2">
        <HojaMovimiento {...ctx} tipo="GASTO" disparador="Gasto directo" titulo="Gasto directo de la cartera" etiquetaMonto="Gasto" etiquetaCuenta="Salió de la cuenta" />
      </div>
    </div>
  );
}

function RegistrosCartera({ a, fechaHoy, operable }: Ctx & { operable: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Registros mensuales</h2>
      {a.registrosCartera.length > 0 ? (
        <ul className="bg-card divide-y rounded-xl border text-sm">
          {a.registrosCartera.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{formatPeriodoLargo(r.periodo)}</p>
                <p className="text-muted-foreground text-xs">
                  En mora <Monto valor={r.capitalEnMora} moneda={a.moneda} />
                  {r.clientesActivos !== null ? ` · ${r.clientesActivos} clientes` : ""}
                </p>
              </div>
              <Monto valor={r.capitalEnCalle} moneda={a.moneda} className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Todavía no registraste ningún mes (capital en la calle y mora).</p>
      )}
      {operable && (
        <HojaFormulario disparador="Registrar mes" titulo="Registro mensual" accion={registrarMesCartera} ocultos={{ activoId: a.id }} textoEnviar="Guardar">
          <div className="flex flex-col gap-1.5">
            <Label>Mes</Label>
            <Input name="periodo" type="month" defaultValue={periodoDe(fechaHoy)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{`En la calle (${a.moneda})`}</Label>
              <Input name="capitalEnCalle" inputMode="decimal" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{`En mora (${a.moneda})`}</Label>
              <Input name="capitalEnMora" inputMode="decimal" defaultValue="0" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Clientes activos (opcional)</Label>
            <Input name="clientesActivos" inputMode="numeric" />
          </div>
        </HojaFormulario>
      )}
    </div>
  );
}

function AccionesCompraventa(ctx: Ctx & { operable: boolean }) {
  const { a } = ctx;
  if (a.fechaVenta) {
    return (
      <BotonConfirmado
        variant="outline"
        className="w-full"
        accion={deshacerVenta.bind(null, a.id)}
        confirmacion="¿Deshacés la venta? Se borran los movimientos de la venta y el activo vuelve a estar en stock."
      >
        Deshacer venta
      </BotonConfirmado>
    );
  }
  if (!ctx.operable) return null;
  return (
    <div className="flex flex-col gap-2">
      <HojaFormulario
        disparador="Registrar venta"
        titulo="Registrar venta"
        descripcion={`Costo total: ${formatMonto(a.costo ?? "0", a.moneda)} (compra + gastos). La ganancia se calcula sola.`}
        accion={registrarVenta}
        ocultos={{ activoId: a.id }}
        textoEnviar="Confirmar venta"
        variante="default"
      >
        <div className="flex flex-col gap-1.5">
          <Label>{`Precio de venta (${a.moneda})`}</Label>
          <Input name="precioVenta" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Entró en la cuenta</Label>
          <NativeSelect name="cuentaId" defaultValue={ctx.cuentaDefecto ?? ctx.cuentas[0]?.id}>
            {ctx.cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fecha de venta</Label>
          <Input name="fecha" type="date" defaultValue={ctx.fechaHoy} max={ctx.fechaHoy} />
        </div>
      </HojaFormulario>
      <div className="grid grid-cols-2 gap-2">
        <HojaMovimiento {...ctx} tipo="GASTO" disparador="Registrar gasto" titulo="Gasto directo (se suma al costo)" etiquetaMonto="Gasto" etiquetaCuenta="Salió de la cuenta" />
        <HojaMovimiento {...ctx} tipo="APLICACION_ACTIVO" disparador="Más capital" titulo="Capital adicional" etiquetaMonto="Monto" etiquetaCuenta="Salió de la cuenta" />
      </div>
    </div>
  );
}

function AccionesTenencia(ctx: Ctx & { operable: boolean }) {
  const { a } = ctx;
  return (
    <div className="flex flex-col gap-2">
      {ctx.operable && (
        <div className="grid grid-cols-2 gap-2">
          <HojaFormulario disparador="Actualizar valuación" titulo="Nueva valuación" accion={actualizarValuacion} ocultos={{ activoId: a.id }} textoEnviar="Guardar" variante="default">
            <div className="flex flex-col gap-1.5">
              <Label>{`Valor (${a.moneda})`}</Label>
              <Input name="valor" inputMode="decimal" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha</Label>
              <Input name="fecha" type="date" defaultValue={ctx.fechaHoy} max={ctx.fechaHoy} />
            </div>
          </HojaFormulario>
          <HojaMovimiento {...ctx} tipo="COBRO_RENDIMIENTO" disparador="Renta cobrada" titulo="Renta cobrada (alquiler, dividendo)" etiquetaMonto="Monto" etiquetaCuenta="Entró en la cuenta" />
        </div>
      )}
      {a.valuaciones.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-semibold">Valuaciones</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {a.valuaciones.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 p-3">
                <span>{formatFechaMedia(v.fecha)}</span>
                <Monto valor={v.valor} moneda={a.moneda} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
