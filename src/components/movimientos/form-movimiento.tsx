"use client";

import { useActionState } from "react";
import { AvisoResultado, BotonEnviar, Campo, errorDe } from "@/components/formulario";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumero } from "@/lib/dinero";
import { guardarMovimiento } from "@/server/acciones/movimientos";

export interface MovimientoEditable {
  id: string;
  tipo: string;
  fecha: string;
  monto: string;
  moneda: "ARS" | "USD";
  cuentaId: string | null;
  cuentaDestinoId: string | null;
  montoDestino: string | null;
  categoriaId: string | null;
  descripcion: string | null;
  vinculado: boolean;
  gastoDeActivo: boolean;
}

export function FormMovimiento({
  m,
  cuentas,
  categorias,
  hoy,
}: {
  m: MovimientoEditable;
  cuentas: { id: string; nombre: string; moneda: "ARS" | "USD" }[];
  categorias: { id: string; nombre: string; tipo: "INGRESO" | "GASTO" }[];
  hoy: string;
}) {
  const [estado, accion] = useActionState(guardarMovimiento, null);
  const cuentasOrigen = m.vinculado ? cuentas.filter((c) => c.moneda === m.moneda) : cuentas;
  const conCategoria = (m.tipo === "GASTO" && !m.gastoDeActivo) || m.tipo === "INGRESO";
  const monto = m.monto.startsWith("-") ? `-${formatNumero(m.monto.slice(1))}` : formatNumero(m.monto);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={m.id} />
      <Campo nombre="monto" etiqueta={`Monto (${m.moneda})`} error={errorDe(estado, "monto")} ayuda={m.tipo === "AJUSTE" ? "Negativo si el saldo real era menor." : undefined}>
        <Input id="monto" name="monto" inputMode="decimal" defaultValue={monto} required />
      </Campo>
      {m.tipo !== "BAJA_INCOBRABLE" && (
        <Campo nombre="cuentaId" etiqueta={m.tipo === "TRANSFERENCIA" ? "Desde la cuenta" : "Cuenta"}>
          <NativeSelect id="cuentaId" name="cuentaId" defaultValue={m.cuentaId ?? ""}>
            {cuentasOrigen.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </NativeSelect>
        </Campo>
      )}
      {m.tipo === "TRANSFERENCIA" && (
        <>
          <Campo nombre="cuentaDestinoId" etiqueta="A la cuenta">
            <NativeSelect id="cuentaDestinoId" name="cuentaDestinoId" defaultValue={m.cuentaDestinoId ?? ""}>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
              ))}
            </NativeSelect>
          </Campo>
          <Campo nombre="montoDestino" etiqueta="Monto que entra (si cambia la moneda)" error={errorDe(estado, "montoDestino")}>
            <Input id="montoDestino" name="montoDestino" inputMode="decimal" defaultValue={m.montoDestino ? formatNumero(m.montoDestino) : ""} />
          </Campo>
        </>
      )}
      {conCategoria && (
        <Campo nombre="categoriaId" etiqueta="Categoría">
          <NativeSelect id="categoriaId" name="categoriaId" defaultValue={m.categoriaId ?? ""}>
            {categorias
              .filter((c) => c.tipo === (m.tipo === "INGRESO" ? "INGRESO" : "GASTO"))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
          </NativeSelect>
        </Campo>
      )}
      <Campo nombre="fecha" etiqueta="Fecha" error={errorDe(estado, "fecha")}>
        <Input id="fecha" name="fecha" type="date" defaultValue={m.fecha} max={hoy} required />
      </Campo>
      <Campo nombre="descripcion" etiqueta="Descripción">
        <Input id="descripcion" name="descripcion" defaultValue={m.descripcion ?? ""} />
      </Campo>
      <AvisoResultado estado={estado} />
      <BotonEnviar>Guardar cambios</BotonEnviar>
    </form>
  );
}
