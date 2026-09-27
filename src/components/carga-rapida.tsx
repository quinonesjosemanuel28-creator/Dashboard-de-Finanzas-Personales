"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Delete,
  HandCoins,
  Landmark,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Decimal } from "@/domain/decimal";
import type { Moneda } from "@/domain/fx";
import type { TipoMovimiento } from "@/domain/movimientos";
import { formatMonto } from "@/lib/dinero";
import { parseNumeroAR } from "@/lib/entrada";
import { TIPOS_MOVIMIENTO, formatFechaMedia } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";
import { type CargaRapida as Payload, guardarCargaRapida } from "@/server/acciones/movimientos";
import type { CuotaSugerida, DatosCargaRapida } from "@/server/consultas/carga-rapida";

type Opcion = "GASTO" | "INGRESO" | "COBRO" | "PAGO" | "TRANSFERENCIA" | "MAS";

const OPCIONES: { valor: Opcion; texto: string; icono: typeof ArrowUpRight }[] = [
  { valor: "GASTO", texto: "Gasto", icono: ArrowUpRight },
  { valor: "INGRESO", texto: "Ingreso", icono: ArrowDownLeft },
  { valor: "COBRO", texto: "Cobro", icono: HandCoins },
  { valor: "PAGO", texto: "Pago", icono: Landmark },
  { valor: "TRANSFERENCIA", texto: "Transferencia", icono: ArrowLeftRight },
  { valor: "MAS", texto: "Más", icono: MoreHorizontal },
];

const AVANZADOS: Exclude<TipoMovimiento, "BAJA_INCOBRABLE">[] = ["APLICACION_ACTIVO", "COBRO_CAPITAL", "TOMA_PASIVO", "PAGO_CAPITAL", "AJUSTE"];

/** Destino elegido en el paso 3. */
type Destino =
  | { clase: "categoria"; id: string; texto: string }
  | { clase: "cuota"; cuota: CuotaSugerida }
  | { clase: "activo"; id: string; texto: string }
  | { clase: "pasivo"; id: string; texto: string }
  | { clase: "cuenta"; id: string; texto: string; moneda: Moneda }
  | { clase: "ninguno" };

/** Agrupa los miles mientras se tipea: "1250000,5" → "1.250.000,5". */
function mostrarMonto(crudo: string): string {
  if (!crudo) return "0";
  const [entero = "0", decimales] = crudo.split(",");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales !== undefined ? `${conMiles},${decimales}` : conMiles;
}

export function CargaRapida({ datos }: { datos: DatosCargaRapida }) {
  const [paso, setPaso] = useState<"tipo" | "mas" | "monto" | "destino" | "cuenta">("tipo");
  const [opcion, setOpcion] = useState<Opcion>("GASTO");
  const [avanzado, setAvanzado] = useState<(typeof AVANZADOS)[number]>("APLICACION_ACTIVO");
  const [monto, setMonto] = useState("");
  const [negativo, setNegativo] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>(datos.cuentas.some((c) => c.moneda === "ARS") ? "ARS" : "USD");
  const [destino, setDestino] = useState<Destino>({ clase: "ninguno" });
  const [cuentaId, setCuentaId] = useState<string>("");
  const [montoDestino, setMontoDestino] = useState("");
  const [fecha, setFecha] = useState(datos.hoy);
  const [descripcion, setDescripcion] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const tipo: Payload["tipo"] = (() => {
    switch (opcion) {
      case "GASTO":
        return "GASTO";
      case "INGRESO":
        return "INGRESO";
      // Con una cuota, el servidor reparte entre interés y capital; si no, es rendimiento o interés.
      case "COBRO":
        return "COBRO_RENDIMIENTO";
      case "PAGO":
        return "PAGO_INTERES";
      case "TRANSFERENCIA":
        return "TRANSFERENCIA";
      case "MAS":
        return avanzado;
    }
  })();

  const cuentasMoneda = datos.cuentas.filter((c) => c.moneda === moneda);
  const cuentaDefecto = datos.cuentaPorDefecto[moneda];
  const cuentaFinal = cuentasMoneda.some((c) => c.id === cuentaId) ? cuentaId : (cuentaDefecto ?? cuentasMoneda[0]?.id ?? "");
  const montoDecimal = parseNumeroAR(monto);
  const transferenciaEntreMonedas = destino.clase === "cuenta" && destino.moneda !== moneda;

  function elegirOpcion(o: Opcion) {
    setOpcion(o);
    setDestino({ clase: "ninguno" });
    setError(null);
    setPaso(o === "MAS" ? "mas" : "monto");
  }

  function tecla(t: string) {
    setError(null);
    if (t === "⌫") return setMonto((m) => m.slice(0, -1));
    if (t === ",") return setMonto((m) => (m.includes(",") ? m : `${m || "0"},`));
    setMonto((m) => {
      const [, dec] = m.split(",");
      if (dec !== undefined && dec.length >= 2) return m;
      if (m === "0") return t;
      return m + t;
    });
  }

  function confirmarMonto() {
    if (!montoDecimal || new Decimal(montoDecimal).lte(0)) return setError("Ingresá el monto.");
    setError(null);
    // El ajuste no tiene destino: va directo a la cuenta.
    setPaso(tipo === "AJUSTE" ? "cuenta" : "destino");
  }

  function elegirDestino(d: Destino) {
    if (d.clase === "cuota" && montoDecimal && new Decimal(montoDecimal).gt(d.cuota.pendiente)) {
      return setError(`La cuota tiene pendiente ${formatMonto(d.cuota.pendiente, d.cuota.moneda)}.`);
    }
    setError(null);
    setDestino(d);
    setPaso("cuenta");
  }

  function reiniciar(mensaje: string) {
    setGuardado(mensaje);
    setPaso("tipo");
    setMonto("");
    setNegativo(false);
    setDestino({ clase: "ninguno" });
    setMontoDestino("");
    setDescripcion("");
    setFecha(datos.hoy);
    setVerTodas(false);
  }

  function guardar() {
    if (!cuentaFinal) return setError(`No tenés cuentas en ${moneda}. Creala en Configuración → Cuentas.`);
    if (transferenciaEntreMonedas && !parseNumeroAR(montoDestino)) return setError("Indicá cuánto entra en la cuenta de destino.");
    const payload: Payload = {
      tipo,
      monto: `${negativo && tipo === "AJUSTE" ? "-" : ""}${montoDecimal}`,
      fecha,
      cuentaId: cuentaFinal,
      cuentaDestinoId: destino.clase === "cuenta" ? destino.id : null,
      montoDestino: transferenciaEntreMonedas ? montoDestino : null,
      categoriaId: destino.clase === "categoria" ? destino.id : null,
      activoId: destino.clase === "activo" ? destino.id : destino.clase === "cuota" && destino.cuota.lado === "activo" ? destino.cuota.padreId : null,
      pasivoId: destino.clase === "pasivo" ? destino.id : destino.clase === "cuota" && destino.cuota.lado === "pasivo" ? destino.cuota.padreId : null,
      cuotaActivoId: destino.clase === "cuota" && destino.cuota.lado === "activo" ? destino.cuota.id : null,
      cuotaPasivoId: destino.clase === "cuota" && destino.cuota.lado === "pasivo" ? destino.cuota.id : null,
      descripcion: descripcion.trim() || null,
    };
    setError(null);
    iniciar(async () => {
      const r = await guardarCargaRapida(payload);
      if (r.ok) reiniciar(`${TIPOS_MOVIMIENTO[tipo]} de ${formatMonto(new Decimal(montoDecimal!), moneda)} guardado.`);
      else setError(r.error);
    });
  }

  // ------------------------------------------------------------ Destinos

  function destinos() {
    if (opcion === "GASTO" || opcion === "INGRESO") {
      const lista = datos.categorias.filter((c) => c.tipo === opcion);
      const principales = lista.slice(0, 6);
      const resto = lista.slice(6);
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {principales.map((c) => (
              <BotonDestino key={c.id} onClick={() => elegirDestino({ clase: "categoria", id: c.id, texto: c.nombre })}>
                {c.nombre}
              </BotonDestino>
            ))}
          </div>
          {resto.length > 0 &&
            (verTodas ? (
              <div className="grid grid-cols-2 gap-2">
                {resto.map((c) => (
                  <BotonDestino key={c.id} onClick={() => elegirDestino({ clase: "categoria", id: c.id, texto: c.nombre })}>
                    {c.nombre}
                  </BotonDestino>
                ))}
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setVerTodas(true)}>
                Ver todas las categorías
              </Button>
            ))}
        </div>
      );
    }
    if (opcion === "COBRO" || opcion === "PAGO") {
      const cuotas = (opcion === "COBRO" ? datos.cuotasActivo : datos.cuotasPasivo).filter((c) => c.moneda === moneda);
      const entidades =
        opcion === "COBRO"
          ? datos.activos.filter((a) => a.moneda === moneda && a.comportamiento !== "COMPRAVENTA")
          : datos.pasivos.filter((p) => p.moneda === moneda);
      return (
        <div className="flex flex-col gap-3">
          {cuotas.length > 0 && (
            <>
              <p className="text-muted-foreground text-xs">Cuotas pendientes</p>
              {cuotas.map((c) => (
                <BotonDestino key={c.id} onClick={() => elegirDestino({ clase: "cuota", cuota: c })}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">
                      {c.nombre} · #{c.numero}
                      <span className="text-muted-foreground block text-xs">{formatFechaMedia(c.fechaVencimiento)}</span>
                    </span>
                    <span className="shrink-0 text-sm">{formatMonto(c.pendiente, c.moneda)}</span>
                  </span>
                </BotonDestino>
              ))}
            </>
          )}
          <p className="text-muted-foreground text-xs">
            {opcion === "COBRO" ? "Otro cobro de un activo (ganancia o renta)" : "Otro pago de interés a un pasivo"}
          </p>
          {entidades.length === 0 && <p className="text-muted-foreground text-sm">No hay {opcion === "COBRO" ? "activos" : "pasivos"} en {moneda}.</p>}
          {entidades.map((e) => (
            <BotonDestino key={e.id} onClick={() => elegirDestino({ clase: opcion === "COBRO" ? "activo" : "pasivo", id: e.id, texto: e.nombre })}>
              {e.nombre}
            </BotonDestino>
          ))}
        </div>
      );
    }
    if (opcion === "TRANSFERENCIA") {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">¿A qué cuenta va? (la de origen se elige después)</p>
          {datos.cuentas.map((c) => (
            <BotonDestino key={c.id} onClick={() => elegirDestino({ clase: "cuenta", id: c.id, texto: c.nombre, moneda: c.moneda })}>
              {c.nombre} <span className="text-muted-foreground">({c.moneda})</span>
            </BotonDestino>
          ))}
        </div>
      );
    }
    // Más: activo o pasivo según el tipo avanzado.
    const conActivo = avanzado === "APLICACION_ACTIVO" || avanzado === "COBRO_CAPITAL";
    const lista = conActivo ? datos.activos.filter((a) => a.moneda === moneda) : datos.pasivos.filter((p) => p.moneda === moneda);
    return (
      <div className="flex flex-col gap-2">
        {lista.length === 0 && <p className="text-muted-foreground text-sm">No hay {conActivo ? "activos" : "pasivos"} en {moneda}.</p>}
        {lista.map((e) => (
          <BotonDestino key={e.id} onClick={() => elegirDestino({ clase: conActivo ? "activo" : "pasivo", id: e.id, texto: e.nombre })}>
            {e.nombre}
          </BotonDestino>
        ))}
      </div>
    );
  }

  const textoDestino =
    destino.clase === "cuota"
      ? `${destino.cuota.nombre} · cuota ${destino.cuota.numero}`
      : destino.clase === "ninguno"
        ? ""
        : destino.texto;

  // ------------------------------------------------------------ Render

  return (
    <div className="flex flex-col gap-4">
      {guardado && paso === "tipo" && (
        <p role="status" className="bg-positivo/10 text-positivo flex items-center gap-2 rounded-md p-3 text-sm">
          <Check className="size-4" /> {guardado}{" "}
          <Link href="/movimientos" className="ml-auto underline">Ver</Link>
        </p>
      )}

      {paso !== "tipo" && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          <button className="underline" onClick={() => setPaso("tipo")}>
            {opcion === "MAS" ? TIPOS_MOVIMIENTO[avanzado] : OPCIONES.find((o) => o.valor === opcion)?.texto}
          </button>
          {(paso === "destino" || paso === "cuenta") && montoDecimal && (
            <>
              ·
              <button className="underline" onClick={() => setPaso("monto")}>
                {negativo && tipo === "AJUSTE" ? "−" : ""}
                {formatMonto(new Decimal(montoDecimal), moneda)}
              </button>
            </>
          )}
          {paso === "cuenta" && textoDestino && (
            <>
              ·
              <button className="truncate underline" onClick={() => setPaso("destino")}>
                {textoDestino}
              </button>
            </>
          )}
        </div>
      )}

      {paso === "tipo" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">¿Qué cargás?</h1>
          <div className="grid grid-cols-2 gap-3">
            {OPCIONES.map((o) => (
              <button
                key={o.valor}
                onClick={() => elegirOpcion(o.valor)}
                className="bg-card active:bg-accent flex h-24 flex-col items-center justify-center gap-2 rounded-xl border text-base font-medium shadow-xs"
              >
                <o.icono className="size-6" />
                {o.texto}
              </button>
            ))}
          </div>
        </>
      )}

      {paso === "mas" && (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Más tipos</h1>
          {AVANZADOS.map((t) => (
            <BotonDestino
              key={t}
              onClick={() => {
                setAvanzado(t);
                setPaso("monto");
              }}
            >
              {TIPOS_MOVIMIENTO[t]}
            </BotonDestino>
          ))}
        </div>
      )}

      {paso === "monto" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(["ARS", "USD"] as const).map((m) => (
              <Button key={m} variant={moneda === m ? "default" : "outline"} onClick={() => setMoneda(m)} aria-pressed={moneda === m}>
                {m}
              </Button>
            ))}
          </div>
          <output aria-live="polite" aria-label="Monto" className="py-4 text-center text-4xl font-semibold tracking-tight tabular-nums">
            <span className="text-muted-foreground mr-2 text-xl">{moneda}</span>
            {negativo && tipo === "AJUSTE" ? "−" : ""}
            {mostrarMonto(monto)}
          </output>
          {tipo === "AJUSTE" && (
            <Button variant="outline" size="sm" onClick={() => setNegativo((n) => !n)}>
              {negativo ? "Ajuste negativo (el saldo real era menor)" : "Ajuste positivo (el saldo real era mayor)"}
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map((t) => (
              <button
                key={t}
                onClick={() => tecla(t)}
                aria-label={t === "⌫" ? "Borrar" : t === "," ? "Coma decimal" : t}
                className="bg-card active:bg-accent flex h-14 items-center justify-center rounded-xl border text-2xl font-medium"
              >
                {t === "⌫" ? <Delete className="size-6" /> : t}
              </button>
            ))}
          </div>
          <Button size="lg" onClick={confirmarMonto}>
            Siguiente
          </Button>
        </div>
      )}

      {paso === "destino" && destinos()}

      {paso === "cuenta" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{opcion === "TRANSFERENCIA" ? "¿Desde qué cuenta?" : tipo === "AJUSTE" ? "¿Qué cuenta ajustás?" : "Cuenta"}</p>
          {cuentasMoneda.length === 0 && (
            <p className="text-muted-foreground text-sm">No tenés cuentas en {moneda}. Creala en Configuración → Cuentas.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {cuentasMoneda
              .filter((c) => !(destino.clase === "cuenta" && destino.id === c.id))
              .map((c) => (
                <Button key={c.id} variant={cuentaFinal === c.id ? "default" : "outline"} className="h-12" onClick={() => setCuentaId(c.id)} aria-pressed={cuentaFinal === c.id}>
                  {c.nombre}
                </Button>
              ))}
          </div>
          {transferenciaEntreMonedas && destino.clase === "cuenta" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Monto que entra en {destino.texto} ({destino.moneda})</span>
              <Input inputMode="decimal" value={montoDestino} onChange={(e) => setMontoDestino(e.target.value)} />
            </label>
          )}
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">
              {fecha === datos.hoy ? "Hoy" : formatFechaMedia(fecha)}
              {descripcion ? ` · ${descripcion}` : " · sin descripción"}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input type="date" aria-label="Fecha" value={fecha} max={datos.hoy} onChange={(e) => setFecha(e.target.value)} />
              <Input aria-label="Descripción" placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          </details>
          <Button size="lg" onClick={guardar} disabled={enviando || !cuentaFinal}>
            {enviando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="bg-negativo/10 text-negativo rounded-md p-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function BotonDestino({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("bg-card active:bg-accent flex min-h-12 w-full items-center rounded-xl border px-4 py-2 text-left text-sm font-medium")}
    >
      {children}
    </button>
  );
}
