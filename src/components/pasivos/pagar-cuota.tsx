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
 * "Pagar" en 2 taps: Pagar → Confirmar pago. Viene prellenado con lo pendiente,
 * la cuenta por defecto de la moneda y la fecha de hoy (SPEC §5.4).
 */
export function PagarCuota({
  cuota,
  moneda,
  cuentas,
  cuentaPorDefecto,
  hoy,
}: {
  cuota: { id: string; numero: number; pendiente: string; fechaVencimiento: string; punitorio: string | null };
  moneda: Moneda;
  cuentas: { id: string; nombre: string }[];
  cuentaPorDefecto: string | null;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(async (previo: Awaited<ReturnType<typeof pagarCuota>> | null, form: FormData) => {
    const r = await pagarCuota(previo, form);
    if (r.ok) setAbierto(false);
    return r;
  }, null);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button size="sm">Pagar</Button>
      </SheetTrigger>
      {/* Sin foco automático: en el celular abriría el teclado y taparía "Confirmar pago". */}
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetTitle>Pagar cuota {cuota.numero}</SheetTitle>
        <SheetDescription>
          Vence el {formatFechaMedia(cuota.fechaVencimiento)} · Pendiente {formatMonto(cuota.pendiente, moneda)}
        </SheetDescription>
        {cuentas.length === 0 ? (
          <p className="text-sm">
            No tenés cuentas en {moneda}. Creá una en Configuración → Cuentas para registrar el pago.
          </p>
        ) : (
          <form action={accion} className="flex flex-col gap-4">
            <input type="hidden" name="cuotaId" value={cuota.id} />
            <Campo nombre={`monto-${cuota.id}`} etiqueta={`Monto (${moneda})`} error={errorDe(estado, "monto")}>
              <Input id={`monto-${cuota.id}`} name="monto" inputMode="decimal" defaultValue={formatNumero(cuota.pendiente)} />
            </Campo>
            <Campo nombre={`cuenta-${cuota.id}`} etiqueta="Desde la cuenta" error={errorDe(estado, "cuentaId")}>
              <NativeSelect id={`cuenta-${cuota.id}`} name="cuentaId" defaultValue={cuentaPorDefecto ?? cuentas[0]?.id}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </NativeSelect>
            </Campo>
            <details>
              <summary className="text-muted-foreground cursor-pointer text-sm">Fecha: hoy</summary>
              <div className="mt-3">
                <Campo nombre={`fecha-${cuota.id}`} etiqueta="Fecha del pago" error={errorDe(estado, "fecha")}>
                  <Input id={`fecha-${cuota.id}`} name="fecha" type="date" defaultValue={hoy} max={hoy} />
                </Campo>
              </div>
            </details>
            {cuota.punitorio && (
              <p className="text-muted-foreground text-xs">
                Punitorio estimado por atraso: {formatMonto(cuota.punitorio, moneda)}. Si lo pagás, cargalo como gasto en la categoría «Punitorios».
              </p>
            )}
            <AvisoResultado estado={estado} />
            <BotonEnviar>Confirmar pago</BotonEnviar>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
