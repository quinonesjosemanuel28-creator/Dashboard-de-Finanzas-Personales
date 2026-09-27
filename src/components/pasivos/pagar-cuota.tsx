"use client";

import { useActionState, useState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Moneda } from "@/domain/fx";
import { formatMonto, formatNumero } from "@/lib/dinero";
import { formatFechaMedia } from "@/lib/etiquetas";
import { pagarCuota } from "@/server/acciones/pasivos";

/**
 * "Pagar" (pasivos) o "Cobrar" (activos) en 2 taps: botón → Confirmar. Viene
 * prellenado con lo pendiente, la cuenta por defecto de la moneda y la fecha
 * de hoy (SPEC §5.4).
 */
export function PagarCuota({
  cuota,
  moneda,
  cuentas,
  cuentaPorDefecto,
  hoy,
  modo = "pagar",
  accion = pagarCuota,
}: {
  modo?: "pagar" | "cobrar";
  accion?: typeof pagarCuota;
  cuota: { id: string; numero: number; pendiente: string; fechaVencimiento: string; punitorio?: string | null };
  moneda: Moneda;
  cuentas: { id: string; nombre: string }[];
  cuentaPorDefecto: string | null;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar] = useActionState(async (previo: Awaited<ReturnType<typeof pagarCuota>> | null, form: FormData) => {
    const r = await accion(previo, form);
    if (r.ok) setAbierto(false);
    return r;
  }, null);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button size="sm">{modo === "pagar" ? "Pagar" : "Cobrar"}</Button>
      </SheetTrigger>
      {/* Sin foco automático: en el celular abriría el teclado y taparía "Confirmar pago". */}
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetTitle>
          {modo === "pagar" ? "Pagar" : "Cobrar"} cuota {cuota.numero}
        </SheetTitle>
        <SheetDescription>
          Vence el {formatFechaMedia(cuota.fechaVencimiento)} · Pendiente {formatMonto(cuota.pendiente, moneda)}
        </SheetDescription>
        {cuentas.length === 0 ? (
          <p className="text-sm">
            No tenés cuentas en {moneda}. Creá una en Configuración → Cuentas para registrar el {modo === "pagar" ? "pago" : "cobro"}.
          </p>
        ) : (
          <form action={enviar} className="flex flex-col gap-4">
            <input type="hidden" name="cuotaId" value={cuota.id} />
            <Campo nombre={`monto-${cuota.id}`} etiqueta={`Monto (${moneda})`} error={errorDe(estado, "monto")}>
              <Input id={`monto-${cuota.id}`} name="monto" inputMode="decimal" defaultValue={formatNumero(cuota.pendiente)} />
            </Campo>
            <Campo nombre={`cuenta-${cuota.id}`} etiqueta={modo === "pagar" ? "Desde la cuenta" : "A la cuenta"} error={errorDe(estado, "cuentaId")}>
              <NativeSelect id={`cuenta-${cuota.id}`} name="cuentaId" defaultValue={cuentaPorDefecto ?? cuentas[0]?.id}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </NativeSelect>
            </Campo>
            <details>
              <summary className="text-muted-foreground cursor-pointer text-sm">Fecha: hoy</summary>
              <div className="mt-3">
                <Campo nombre={`fecha-${cuota.id}`} etiqueta={modo === "pagar" ? "Fecha del pago" : "Fecha del cobro"} error={errorDe(estado, "fecha")}>
                  <Input id={`fecha-${cuota.id}`} name="fecha" type="date" defaultValue={hoy} max={hoy} />
                </Campo>
              </div>
            </details>
            {modo === "pagar" && cuota.punitorio && (
              <p className="text-muted-foreground text-xs">
                Punitorio estimado por atraso: {formatMonto(cuota.punitorio, moneda)}. Si lo pagás, cargalo como gasto en la categoría «Punitorios».
              </p>
            )}
            <AvisoResultado estado={estado} />
            <BotonEnviar>{modo === "pagar" ? "Confirmar pago" : "Confirmar cobro"}</BotonEnviar>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
