"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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
import { ESQUEMAS, FRECUENCIAS, TIPOS_PASIVO, formatFechaMedia } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";
import { type AltaPasivo, crearPasivo } from "@/server/acciones/pasivos";

interface Opcion {
  id: string;
  nombre: string;
}

interface CuentaOpcion extends Opcion {
  moneda: Moneda;
}

const PASOS = ["Inversor", "Condiciones", "Cronograma", "Confirmar"] as const;

export function AltaPasivo({
  inversores,
  cuentas,
  hoy,
}: {
  inversores: Opcion[];
  cuentas: CuentaOpcion[];
  hoy: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  // Paso 1: inversor
  const [contraparteId, setContraparteId] = useState(inversores[0]?.id ?? "nuevo");
  const [contraparteNueva, setContraparteNueva] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreTocado, setNombreTocado] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPOS_PASIVO>("MUTUO_INVERSOR");

  // Paso 2: condiciones (defaults del contrato estándar, SPEC §8.3)
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [capital, setCapital] = useState("");
  const [tasa, setTasa] = useState("4");
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [plazoMeses, setPlazoMeses] = useState("12");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>("MENSUAL");
  const [diaPago, setDiaPago] = useState(String(diaPagoPorDefecto(hoy)));
  const [diaPagoTocado, setDiaPagoTocado] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [vencimientoTocado, setVencimientoTocado] = useState(false);
  const [esquema, setEsquema] = useState<EsquemaCronograma>("INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO");
  const [instrumentacion, setInstrumentacion] = useState<"PERSONAL" | "SOCIEDAD">("PERSONAL");
  const [preavisoDias, setPreavisoDias] = useState("90");
  const [penalidad, setPenalidad] = useState("30");
  const [punitorio, setPunitorio] = useState("2");
  const [notas, setNotas] = useState("");

  // Paso 3: cronograma
  const [cuotas, setCuotas] = useState<CuotaEditable[]>([]);
  const [claveCronograma, setClaveCronograma] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [pagadasHasta, setPagadasHasta] = useState(periodoDe(hoy));
  const [registrarIngreso, setRegistrarIngreso] = useState(true);
  const [cuentaIngreso, setCuentaIngreso] = useState("");

  const nombreInversor = contraparteId === "nuevo" ? contraparteNueva.trim() : inversores.find((i) => i.id === contraparteId)?.nombre ?? "";
  const nombreFinal = nombreTocado ? nombre : nombreInversor ? `Mutuo ${nombreInversor}` : "";
  const diaPagoNum = Number(diaPago);
  const plazoNum = Number(plazoMeses);
  const vencimientoSugerido = useMemo(() => {
    if (!esFechaValida(fechaInicio) || !Number.isInteger(plazoNum) || plazoNum < 1 || !(diaPagoNum >= 1 && diaPagoNum <= 31)) return "";
    return fechaVencimientoSugerida(fechaInicio, diaPagoNum, plazoNum);
  }, [fechaInicio, plazoNum, diaPagoNum]);
  const vencimientoFinal = vencimientoTocado ? fechaVencimiento : vencimientoSugerido;
  const capitalNum = parseNumeroAR(capital);
  const tasaNum = parsePorcentajeAR(tasa);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === moneda);
  const cuentaIngresoFinal = cuentasMoneda.some((c) => c.id === cuentaIngreso) ? cuentaIngreso : (cuentasMoneda[0]?.id ?? "");
  const conIngreso = !enCurso && registrarIngreso && cuentaIngresoFinal !== "";

  function validarPaso(n: number): string | null {
    if (n === 0) {
      if (contraparteId === "nuevo" ? !contraparteNueva.trim() : !contraparteId) return "Elegí o cargá el inversor.";
      if (!nombreFinal.trim()) return "Poné un nombre al pasivo.";
    }
    if (n === 1) {
      if (capitalNum === null || !new Decimal(capitalNum).gt(0)) return "Ingresá el capital.";
      if (tasaNum === null) return "Ingresá la tasa mensual.";
      if (!esFechaValida(fechaInicio)) return "Revisá la fecha de inicio.";
      if (!Number.isInteger(plazoNum) || plazoNum < 1) return "El plazo tiene que ser un número entero de meses.";
      if (!Number.isInteger(diaPagoNum) || diaPagoNum < 1 || diaPagoNum > 31) return "El día de pago va de 1 a 31.";
      if (!esFechaValida(vencimientoFinal)) return "Revisá la fecha de vencimiento.";
    }
    return null;
  }

  function parametros() {
    return {
      capital: new Decimal(capitalNum!).toFixed(2),
      tasaMensual: tasaNum!,
      esquema,
      fechaInicio,
      fechaVencimiento: vencimientoFinal,
      plazoMeses: plazoNum,
      diaPago: diaPagoNum,
      frecuenciaPago: frecuencia,
    };
  }

  function avanzar() {
    const e = validarPaso(paso);
    if (e) return setError(e);
    setError(null);
    if (paso === 1) {
      const p = parametros();
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
    if (paso === 2) {
      const e2 = validarCronograma();
      if (e2) return setError(e2);
    }
    setPaso(paso + 1);
    window.scrollTo({ top: 0 });
  }

  function validarCronograma(): string | null {
    return validarCuotas(cuotas, new Decimal(capitalNum!).toFixed(2), moneda);
  }

  function editarCuota(i: number, campo: "fechaVencimiento" | "interes" | "capital", valor: string) {
    setCuotas((prev) => prev.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  }

  function confirmar() {
    const p = parametros();
    const payload: AltaPasivo = {
      contraparteId: contraparteId === "nuevo" ? null : contraparteId,
      contraparteNueva: contraparteId === "nuevo" ? contraparteNueva.trim() : null,
      nombre: nombreFinal.trim(),
      tipo,
      moneda,
      ...p,
      instrumentacion,
      preavisoDias: preavisoDias.trim() === "" ? null : Number(preavisoDias),
      penalidadRetiroPct: penalidad.trim() === "" ? null : parsePorcentajeAR(penalidad),
      punitorioMensual: punitorio.trim() === "" ? null : parsePorcentajeAR(punitorio),
      notas: notas.trim() || null,
      cuotas: cuotasParaEnviar(cuotas),
      pagadasHasta: enCurso ? pagadasHasta : null,
      ingresoCapitalCuentaId: conIngreso ? cuentaIngresoFinal : null,
    };
    iniciar(async () => {
      const r = await crearPasivo(payload);
      if (r.ok && r.id) router.push(`/pasivos/${r.id}`);
      else if (!r.ok) setError(r.error);
    });
  }

  function elegirInstrumentacion(v: "PERSONAL" | "SOCIEDAD") {
    if (v === "SOCIEDAD" && !window.confirm("Esta estructura está marcada para dejar de usarse. ¿Confirmás?")) return;
    setInstrumentacion(v);
  }

  const pagadasPreview = (c: CuotaEditable) => enCurso && periodoDe(c.fechaVencimiento) <= pagadasHasta;
  const interesTotal = totalInteres(cuotas);

  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-4 gap-1" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p} className="flex flex-col gap-1">
            <span className={cn("h-1 rounded-full", i <= paso ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-[11px]", i === paso ? "font-medium" : "text-muted-foreground")}>{p}</span>
          </li>
        ))}
      </ol>

      {paso === 0 && (
        <div className="flex flex-col gap-4">
          <Campo nombre="contraparte" etiqueta="Inversor">
            <NativeSelect id="contraparte" value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
              {inversores.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
              <option value="nuevo">+ Nuevo inversor</option>
            </NativeSelect>
          </Campo>
          {contraparteId === "nuevo" && (
            <Campo nombre="contraparteNueva" etiqueta="Nombre del inversor nuevo">
              <Input id="contraparteNueva" value={contraparteNueva} onChange={(e) => setContraparteNueva(e.target.value)} autoFocus />
            </Campo>
          )}
          <Campo nombre="nombre" etiqueta="Nombre del pasivo" ayuda="Para reconocerlo en las listas.">
            <Input
              id="nombre"
              value={nombreFinal}
              onChange={(e) => {
                setNombreTocado(true);
                setNombre(e.target.value);
              }}
            />
          </Campo>
          <Campo nombre="tipo" etiqueta="Tipo">
            <NativeSelect id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as keyof typeof TIPOS_PASIVO)}>
              {Object.entries(TIPOS_PASIVO).map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </NativeSelect>
          </Campo>
        </div>
      )}

      {paso === 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Moneda">
            {(["USD", "ARS"] as const).map((m) => (
              <Button key={m} type="button" variant={moneda === m ? "default" : "outline"} onClick={() => setMoneda(m)} aria-pressed={moneda === m}>
                {m}
              </Button>
            ))}
          </div>
          <Campo nombre="capital" etiqueta={`Capital (${moneda})`}>
            <Input id="capital" inputMode="decimal" placeholder="10.000" value={capital} onChange={(e) => setCapital(e.target.value)} autoFocus />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo nombre="tasa" etiqueta="Tasa mensual (%)" ayuda={tasaNum ? `TNA ${formatTasa(new Decimal(tasaNum).mul(12))}` : undefined}>
              <Input id="tasa" inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} />
            </Campo>
            <Campo nombre="plazo" etiqueta="Plazo (meses)">
              <Input id="plazo" inputMode="numeric" value={plazoMeses} onChange={(e) => setPlazoMeses(e.target.value)} />
            </Campo>
          </div>
          <Campo nombre="fechaInicio" etiqueta="Fecha de inicio">
            <Input
              id="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                if (!diaPagoTocado && esFechaValida(e.target.value)) setDiaPago(String(diaPagoPorDefecto(e.target.value)));
              }}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo nombre="frecuencia" etiqueta="Paga el interés">
              <NativeSelect id="frecuencia" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as FrecuenciaPago)}>
                {Object.entries(FRECUENCIAS).map(([v, t]) => (
                  <option key={v} value={v}>{t}</option>
                ))}
              </NativeSelect>
            </Campo>
            <Campo nombre="diaPago" etiqueta="Día de pago" ayuda="Por defecto, el día de inicio.">
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
          <Campo nombre="fechaVencimiento" etiqueta="Vencimiento del capital" ayuda="Como figura en el contrato.">
            <Input
              id="fechaVencimiento"
              type="date"
              value={vencimientoFinal}
              onChange={(e) => {
                setVencimientoTocado(true);
                setFechaVencimiento(e.target.value);
              }}
            />
          </Campo>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Instrumentado a nombre de</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={instrumentacion === "PERSONAL" ? "default" : "outline"} onClick={() => elegirInstrumentacion("PERSONAL")}>
                José (personal)
              </Button>
              <Button type="button" variant={instrumentacion === "SOCIEDAD" ? "default" : "outline"} onClick={() => elegirInstrumentacion("SOCIEDAD")}>
                Sociedad
              </Button>
            </div>
          </fieldset>

          <details className="bg-card rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">Más condiciones del contrato</summary>
            <div className="mt-4 flex flex-col gap-4">
              <Campo nombre="esquema" etiqueta="Esquema">
                <NativeSelect id="esquema" value={esquema} onChange={(e) => setEsquema(e.target.value as EsquemaCronograma)}>
                  {Object.entries(ESQUEMAS).map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </NativeSelect>
              </Campo>
              <div className="grid grid-cols-3 gap-3">
                <Campo nombre="preaviso" etiqueta="Preaviso (días)">
                  <Input id="preaviso" inputMode="numeric" value={preavisoDias} onChange={(e) => setPreavisoDias(e.target.value)} />
                </Campo>
                <Campo nombre="penalidad" etiqueta="Penalidad (%)">
                  <Input id="penalidad" inputMode="decimal" value={penalidad} onChange={(e) => setPenalidad(e.target.value)} />
                </Campo>
                <Campo nombre="punitorio" etiqueta="Punitorio (%/mes)">
                  <Input id="punitorio" inputMode="decimal" value={punitorio} onChange={(e) => setPunitorio(e.target.value)} />
                </Campo>
              </div>
              <Campo nombre="notas" etiqueta="Notas">
                <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </Campo>
            </div>
          </details>
        </div>
      )}

      {paso === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Es una propuesta: revisá que coincida con el contrato y corregí fechas o montos si hace falta.
          </p>

          <Card className="gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">¿El mutuo ya está en curso?</span>
              <input type="checkbox" className="size-5 accent-current" checked={enCurso} onChange={(e) => setEnCurso(e.target.checked)} />
            </label>
            {enCurso && (
              <Campo nombre="pagadasHasta" etiqueta="Cuotas pagadas hasta" ayuda="Se marcan como pagadas sin crear movimientos (tus saldos ya los reflejan).">
                <Input id="pagadasHasta" type="month" value={pagadasHasta} onChange={(e) => setPagadasHasta(e.target.value)} />
              </Campo>
            )}
            {!enCurso && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Registrar la entrada del capital</span>
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={registrarIngreso && cuentasMoneda.length > 0}
                    disabled={cuentasMoneda.length === 0}
                    onChange={(e) => setRegistrarIngreso(e.target.checked)}
                  />
                </label>
                {cuentasMoneda.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No tenés cuentas en {moneda}. Podés crearlas en Configuración → Cuentas.</p>
                ) : (
                  registrarIngreso && (
                    <Campo nombre="cuentaIngreso" etiqueta="Cuenta donde entró">
                      <NativeSelect id="cuentaIngreso" value={cuentaIngresoFinal} onChange={(e) => setCuentaIngreso(e.target.value)}>
                        {cuentasMoneda.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </NativeSelect>
                    </Campo>
                  )
                )}
              </>
            )}
          </Card>

          <EditorCuotas cuotas={cuotas} moneda={moneda} onEditar={editarCuota} marcada={pagadasPreview} />
        </div>
      )}

      {paso === 3 && (
        <Card className="gap-3 text-sm">
          <Fila etiqueta="Inversor" valor={nombreInversor} />
          <Fila etiqueta="Pasivo" valor={nombreFinal} />
          <Fila etiqueta="Capital" valor={formatMonto(capitalNum ?? "0", moneda)} />
          <Fila etiqueta="Tasa" valor={`${formatTasa(tasaNum ?? "0")} mensual · ${FRECUENCIAS[frecuencia]}`} />
          <Fila etiqueta="Inicio" valor={formatFechaMedia(fechaInicio)} />
          <Fila etiqueta="Vencimiento" valor={formatFechaMedia(vencimientoFinal)} />
          <Fila etiqueta="Día de pago" valor={diaPago} />
          <Fila etiqueta="Cuotas" valor={`${cuotas.length} · interés total ${formatMonto(interesTotal, moneda)}`} />
          {enCurso && <Fila etiqueta="Pagadas hasta" valor={pagadasHasta} />}
          {conIngreso && <Fila etiqueta="Entrada del capital" valor={cuentasMoneda.find((c) => c.id === cuentaIngresoFinal)?.nombre ?? ""} />}
          {instrumentacion === "SOCIEDAD" && (
            <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" /> Instrumentado vía sociedad: queda como pendiente de regularizar.
            </p>
          )}
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
        {paso < PASOS.length - 1 ? (
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
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
