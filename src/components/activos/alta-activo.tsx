"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorCuotas } from "@/components/cronograma/editor-cuotas";
import {
  type CuotaEditable,
  aEditable,
  cuotasParaEnviar,
  esFechaValida,
  totalInteres,
  validarCuotas,
} from "@/components/cronograma/cuotas-editables";
import { Campo } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Comportamiento } from "@/domain/activos";
import {
  type EsquemaCronograma,
  type FrecuenciaPago,
  diaPagoPorDefecto,
  fechaVencimientoSugerida,
  generarCronograma,
} from "@/domain/cronograma";
import { Decimal } from "@/domain/decimal";
import { periodoDe } from "@/domain/fechas";
import type { Moneda } from "@/domain/fx";
import { formatMonto, formatTasa } from "@/lib/dinero";
import { parseNumeroAR, parsePorcentajeAR } from "@/lib/entrada";
import { COMPORTAMIENTOS, ESQUEMAS, FRECUENCIAS, formatFechaMedia } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";
import { type AltaActivo, crearActivo } from "@/server/acciones/activos";

interface TipoOpcion {
  id: string;
  nombre: string;
  comportamiento: Comportamiento;
}

const ETIQUETA_CAPITAL: Record<Comportamiento, string> = {
  RENTA_PROGRAMADA: "Capital prestado",
  CARTERA: "Capital aplicado",
  COMPRAVENTA: "Precio de compra",
  TENENCIA: "Costo de compra",
};

const ETIQUETA_FECHA: Record<Comportamiento, string> = {
  RENTA_PROGRAMADA: "Fecha del préstamo",
  CARTERA: "Fecha de inicio",
  COMPRAVENTA: "Fecha de compra",
  TENENCIA: "Fecha de compra",
};

export function AltaActivo({
  tipos,
  contrapartes,
  cuentas,
  hoy,
}: {
  tipos: TipoOpcion[];
  contrapartes: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string; moneda: Moneda }[];
  hoy: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const [tipoId, setTipoId] = useState("");
  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const comp = tipo?.comportamiento ?? "CARTERA";
  const esRenta = comp === "RENTA_PROGRAMADA";
  const pasos = esRenta ? ["Tipo", "Datos", "Cronograma", "Confirmar"] : ["Tipo", "Datos", "Confirmar"];
  const ultimo = pasos.length - 1;

  // Datos comunes
  const [nombre, setNombre] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const [contraparteNueva, setContraparteNueva] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [capital, setCapital] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [notas, setNotas] = useState("");
  const [registrarSalida, setRegistrarSalida] = useState(true);
  const [cuentaSalida, setCuentaSalida] = useState("");
  // Renta programada
  const [tasa, setTasa] = useState("8");
  const [plazoMeses, setPlazoMeses] = useState("12");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>("MENSUAL");
  const [diaPago, setDiaPago] = useState(String(diaPagoPorDefecto(hoy)));
  const [diaPagoTocado, setDiaPagoTocado] = useState(false);
  const [fechaFin, setFechaFin] = useState("");
  const [finTocado, setFinTocado] = useState(false);
  const [esquema, setEsquema] = useState<EsquemaCronograma>("INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO");
  const [cuotas, setCuotas] = useState<CuotaEditable[]>([]);
  const [claveCronograma, setClaveCronograma] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [cobradasHasta, setCobradasHasta] = useState(periodoDe(hoy));
  // Cartera / compraventa / tenencia
  const [rendimiento, setRendimiento] = useState("");
  const [valuacion, setValuacion] = useState("");

  const capitalNum = parseNumeroAR(capital);
  const tasaNum = parsePorcentajeAR(tasa);
  const plazoNum = Number(plazoMeses);
  const diaPagoNum = Number(diaPago);
  const finSugerido = useMemo(() => {
    if (!esFechaValida(fechaInicio) || !Number.isInteger(plazoNum) || plazoNum < 1 || !(diaPagoNum >= 1 && diaPagoNum <= 31)) return "";
    return fechaVencimientoSugerida(fechaInicio, diaPagoNum, plazoNum);
  }, [fechaInicio, plazoNum, diaPagoNum]);
  const finFinal = finTocado ? fechaFin : finSugerido;
  const cuentasMoneda = cuentas.filter((c) => c.moneda === moneda);
  const cuentaSalidaFinal = cuentasMoneda.some((c) => c.id === cuentaSalida) ? cuentaSalida : (cuentasMoneda[0]?.id ?? "");
  const conSalida = !(esRenta && enCurso) && registrarSalida && cuentaSalidaFinal !== "";
  const nombreContraparte = contraparteId === "nuevo" ? contraparteNueva.trim() : (contrapartes.find((c) => c.id === contraparteId)?.nombre ?? "");
  const nombreFinal = nombre.trim() || (tipo ? `${tipo.nombre}${nombreContraparte ? ` · ${nombreContraparte}` : ""}` : "");

  function parametrosCronograma() {
    return {
      capital: new Decimal(capitalNum!).toFixed(2),
      tasaMensual: tasaNum!,
      esquema,
      fechaInicio,
      fechaVencimiento: finFinal,
      plazoMeses: plazoNum,
      diaPago: diaPagoNum,
      frecuenciaPago: frecuencia,
    };
  }

  function validarPaso(n: number): string | null {
    if (n === 0 && !tipo) return "Elegí el tipo de activo.";
    if (n === 1) {
      if (!nombreFinal) return "Poné un nombre.";
      if (contraparteId === "nuevo" && !contraparteNueva.trim()) return "Escribí el nombre de la contraparte.";
      if (capitalNum === null || !new Decimal(capitalNum).gt(0)) return `Ingresá el ${ETIQUETA_CAPITAL[comp].toLowerCase()}.`;
      if (!esFechaValida(fechaInicio)) return "Revisá la fecha.";
      if (fechaInicio > hoy) return "La fecha no puede ser futura.";
      if (esRenta) {
        if (tasaNum === null) return "Ingresá la tasa mensual.";
        if (!Number.isInteger(plazoNum) || plazoNum < 1) return "El plazo tiene que ser un número entero de meses.";
        if (!Number.isInteger(diaPagoNum) || diaPagoNum < 1 || diaPagoNum > 31) return "El día de cobro va de 1 a 31.";
        if (!esFechaValida(finFinal)) return "Revisá la fecha de vencimiento.";
      }
      if (rendimiento.trim() && parsePorcentajeAR(rendimiento) === null) return "Revisá el rendimiento esperado.";
      if (valuacion.trim() && parseNumeroAR(valuacion) === null) return "Revisá la valuación.";
    }
    if (n === 2 && esRenta) return validarCuotas(cuotas, new Decimal(capitalNum!).toFixed(2), moneda);
    return null;
  }

  function avanzar() {
    const e = validarPaso(paso);
    if (e) return setError(e);
    setError(null);
    if (paso === 1 && esRenta) {
      const p = parametrosCronograma();
      const clave = JSON.stringify(p);
      if (clave !== claveCronograma) {
        try {
          setCuotas(generarCronograma(p).map(aEditable));
          setClaveCronograma(clave);
        } catch (err) {
          return setError(err instanceof Error ? err.message : "No se pudo generar el cronograma.");
        }
      }
    }
    setPaso(paso + 1);
    window.scrollTo({ top: 0 });
  }

  function confirmar() {
    if (!tipo) return;
    const payload: AltaActivo = {
      tipoActivoId: tipo.id,
      nombre: nombreFinal,
      contraparteId: contraparteId && contraparteId !== "nuevo" ? contraparteId : null,
      contraparteNueva: contraparteId === "nuevo" ? contraparteNueva.trim() : null,
      moneda,
      capitalInicial: new Decimal(capitalNum!).toFixed(2),
      fechaInicio,
      notas: notas.trim() || null,
      salidaCuentaId: conSalida ? cuentaSalidaFinal : null,
      renta: esRenta
        ? {
            tasaMensual: tasaNum!,
            esquema,
            plazoMeses: plazoNum,
            diaPago: diaPagoNum,
            frecuenciaPago: frecuencia,
            fechaFin: finFinal,
            cuotas: cuotasParaEnviar(cuotas),
            cobradasHasta: enCurso ? cobradasHasta : null,
          }
        : null,
      rendimientoEsperadoMensual: rendimiento.trim() ? parsePorcentajeAR(rendimiento) : null,
      valuacionActual: valuacion.trim() ? new Decimal(parseNumeroAR(valuacion)!).toFixed(2) : null,
    };
    iniciar(async () => {
      const r = await crearActivo(payload);
      if (r.ok && r.id) router.push(`/activos/${r.id}`);
      else if (!r.ok) setError(r.error);
    });
  }

  function editarCuota(i: number, campo: "fechaVencimiento" | "interes" | "capital", valor: string) {
    setCuotas((prev) => prev.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  }

  const agrupados = (["RENTA_PROGRAMADA", "CARTERA", "COMPRAVENTA", "TENENCIA"] as Comportamiento[])
    .map((c) => ({ comportamiento: c, tipos: tipos.filter((t) => t.comportamiento === c) }))
    .filter((g) => g.tipos.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <ol className={cn("grid gap-1", pasos.length === 4 ? "grid-cols-4" : "grid-cols-3")} aria-label="Pasos">
        {pasos.map((p, i) => (
          <li key={p} className="flex flex-col gap-1">
            <span className={cn("h-1 rounded-full", i <= paso ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-[11px]", i === paso ? "font-medium" : "text-muted-foreground")}>{p}</span>
          </li>
        ))}
      </ol>

      {paso === 0 && (
        <div className="flex flex-col gap-4">
          {agrupados.map((g) => (
            <div key={g.comportamiento} className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs">{COMPORTAMIENTOS[g.comportamiento]}</p>
              <div className="flex flex-col gap-2">
                {g.tipos.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant={tipoId === t.id ? "default" : "outline"}
                    className="h-12 justify-start"
                    aria-pressed={tipoId === t.id}
                    onClick={() => setTipoId(t.id)}
                  >
                    {t.nombre}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {paso === 1 && tipo && (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">{tipo.nombre}</p>
          <div className="grid grid-cols-2 gap-2" aria-label="Moneda">
            {(["ARS", "USD"] as const).map((m) => (
              <Button key={m} type="button" variant={moneda === m ? "default" : "outline"} onClick={() => setMoneda(m)} aria-pressed={moneda === m}>
                {m}
              </Button>
            ))}
          </div>
          <Campo nombre="capital" etiqueta={`${ETIQUETA_CAPITAL[comp]} (${moneda})`}>
            <Input id="capital" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} />
          </Campo>
          <Campo nombre="fechaInicio" etiqueta={ETIQUETA_FECHA[comp]}>
            <Input
              id="fechaInicio"
              type="date"
              max={hoy}
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                if (!diaPagoTocado && esFechaValida(e.target.value)) setDiaPago(String(diaPagoPorDefecto(e.target.value)));
              }}
            />
          </Campo>
          <Campo nombre="contraparte" etiqueta={esRenta ? "Deudor" : "Contraparte (opcional)"}>
            <NativeSelect id="contraparte" value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
              <option value="">Sin contraparte</option>
              {contrapartes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              <option value="nuevo">+ Nueva</option>
            </NativeSelect>
          </Campo>
          {contraparteId === "nuevo" && (
            <Campo nombre="contraparteNueva" etiqueta="Nombre de la contraparte nueva">
              <Input id="contraparteNueva" value={contraparteNueva} onChange={(e) => setContraparteNueva(e.target.value)} />
            </Campo>
          )}

          {esRenta && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo nombre="tasa" etiqueta="Tasa mensual (%)" ayuda={tasaNum ? `TNA ${formatTasa(new Decimal(tasaNum).mul(12))}` : undefined}>
                  <Input id="tasa" inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} />
                </Campo>
                <Campo nombre="plazo" etiqueta="Plazo (meses)">
                  <Input id="plazo" inputMode="numeric" value={plazoMeses} onChange={(e) => setPlazoMeses(e.target.value)} />
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo nombre="frecuencia" etiqueta="Cobra el interés">
                  <NativeSelect id="frecuencia" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as FrecuenciaPago)}>
                    {Object.entries(FRECUENCIAS).map(([v, t]) => (
                      <option key={v} value={v}>{t}</option>
                    ))}
                  </NativeSelect>
                </Campo>
                <Campo nombre="diaPago" etiqueta="Día de cobro">
                  <Input
                    id="diaPago"
                    inputMode="numeric"
                    value={diaPago}
                    onChange={(e) => {
                      setDiaPagoTocado(true);
                      setDiaPago(e.target.value);
                    }}
                  />
                </Campo>
              </div>
              <Campo nombre="fechaFin" etiqueta="Vencimiento del capital">
                <Input
                  id="fechaFin"
                  type="date"
                  value={finFinal}
                  onChange={(e) => {
                    setFinTocado(true);
                    setFechaFin(e.target.value);
                  }}
                />
              </Campo>
              <Campo nombre="esquema" etiqueta="Esquema">
                <NativeSelect id="esquema" value={esquema} onChange={(e) => setEsquema(e.target.value as EsquemaCronograma)}>
                  {Object.entries(ESQUEMAS).map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </NativeSelect>
              </Campo>
            </>
          )}

          {(comp === "CARTERA" || comp === "COMPRAVENTA") && (
            <Campo nombre="rendimiento" etiqueta="Rendimiento esperado mensual (%, opcional)" ayuda="Referencia para comparar con lo real.">
              <Input id="rendimiento" inputMode="decimal" value={rendimiento} onChange={(e) => setRendimiento(e.target.value)} />
            </Campo>
          )}
          {comp === "TENENCIA" && (
            <Campo nombre="valuacion" etiqueta={`Valuación actual (${moneda}, opcional)`} ayuda="Si no la cargás, se usa el costo.">
              <Input id="valuacion" inputMode="decimal" value={valuacion} onChange={(e) => setValuacion(e.target.value)} />
            </Campo>
          )}

          {!esRenta && salidaCapital()}

          <Campo nombre="nombre" etiqueta="Nombre" ayuda={nombre ? undefined : `Si lo dejás vacío: «${nombreFinal}»`}>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo nombre="notas" etiqueta="Notas (opcional)">
            <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Campo>
        </div>
      )}

      {paso === 2 && esRenta && (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">Es una propuesta: corregí fechas o montos si hace falta.</p>
          <Card className="gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">¿El préstamo ya está en curso?</span>
              <input type="checkbox" className="size-5" checked={enCurso} onChange={(e) => setEnCurso(e.target.checked)} />
            </label>
            {enCurso ? (
              <Campo nombre="cobradasHasta" etiqueta="Cuotas cobradas hasta" ayuda="Se marcan como cobradas sin crear movimientos.">
                <Input id="cobradasHasta" type="month" value={cobradasHasta} onChange={(e) => setCobradasHasta(e.target.value)} />
              </Campo>
            ) : (
              salidaCapital()
            )}
          </Card>
          <EditorCuotas
            cuotas={cuotas}
            moneda={moneda}
            onEditar={editarCuota}
            marcada={(c) => enCurso && periodoDe(c.fechaVencimiento) <= cobradasHasta}
            textoMarcada="Cobrada"
          />
        </div>
      )}

      {paso === ultimo && tipo && (
        <Card className="gap-3 text-sm">
          <Fila etiqueta="Tipo" valor={tipo.nombre} />
          <Fila etiqueta="Nombre" valor={nombreFinal} />
          {nombreContraparte && <Fila etiqueta={esRenta ? "Deudor" : "Contraparte"} valor={nombreContraparte} />}
          <Fila etiqueta={ETIQUETA_CAPITAL[comp]} valor={formatMonto(capitalNum ?? "0", moneda)} />
          <Fila etiqueta={ETIQUETA_FECHA[comp]} valor={formatFechaMedia(fechaInicio)} />
          {esRenta && (
            <>
              <Fila etiqueta="Tasa" valor={`${formatTasa(tasaNum ?? "0")} mensual · ${FRECUENCIAS[frecuencia]}`} />
              <Fila etiqueta="Vencimiento" valor={formatFechaMedia(finFinal)} />
              <Fila etiqueta="Cuotas" valor={`${cuotas.length} · interés total ${formatMonto(totalInteres(cuotas), moneda)}`} />
              {enCurso && <Fila etiqueta="Cobradas hasta" valor={cobradasHasta} />}
            </>
          )}
          {rendimiento.trim() && <Fila etiqueta="Rendimiento esperado" valor={`${formatTasa(parsePorcentajeAR(rendimiento) ?? "0")} mensual`} />}
          {valuacion.trim() && <Fila etiqueta="Valuación" valor={formatMonto(parseNumeroAR(valuacion) ?? "0", moneda)} />}
          <Fila etiqueta="Salida del capital" valor={conSalida ? (cuentasMoneda.find((c) => c.id === cuentaSalidaFinal)?.nombre ?? "") : "No se registra"} />
        </Card>
      )}

      {error && (
        <p role="alert" className="bg-negativo/10 text-negativo rounded-md p-3 text-sm">
          {error}
        </p>
      )}

      <div className="bg-background/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2 py-2 backdrop-blur">
        <Button type="button" variant="outline" size="lg" disabled={paso === 0 || enviando} onClick={() => { setError(null); setPaso(paso - 1); }}>
          Atrás
        </Button>
        {paso < ultimo ? (
          <Button type="button" size="lg" onClick={avanzar}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={enviando} onClick={confirmar}>
            {enviando ? "Guardando…" : "Confirmar alta"}
          </Button>
        )}
      </div>
    </div>
  );

  function salidaCapital() {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Registrar la salida del capital desde una cuenta</span>
          <input
            type="checkbox"
            className="size-5"
            checked={registrarSalida && cuentasMoneda.length > 0}
            disabled={cuentasMoneda.length === 0}
            onChange={(e) => setRegistrarSalida(e.target.checked)}
          />
        </label>
        {cuentasMoneda.length === 0 ? (
          <p className="text-muted-foreground text-xs">No tenés cuentas en {moneda}. Si el activo ya existía, no hace falta.</p>
        ) : registrarSalida ? (
          <NativeSelect aria-label="Cuenta de salida" value={cuentaSalidaFinal} onChange={(e) => setCuentaSalida(e.target.value)}>
            {cuentasMoneda.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </NativeSelect>
        ) : (
          <p className="text-muted-foreground text-xs">Sin movimiento: usalo para activos que ya tenías antes de empezar a usar la app.</p>
        )}
      </div>
    );
  }
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
