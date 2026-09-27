import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonConfirmado } from "@/components/boton-confirmado";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { FormMovimiento } from "@/components/movimientos/form-movimiento";
import { Card } from "@/components/ui/card";
import { formatNumero } from "@/lib/dinero";
import { TIPOS_MOVIMIENTO, formatFechaMedia } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import { eliminarMovimiento } from "@/server/acciones/movimientos";
import { obtenerMovimiento } from "@/server/consultas/movimientos";
import { db } from "@/server/db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Movimiento" };

export default async function MovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const m = await obtenerMovimiento(id);
  if (!m) notFound();
  const [cuentas, categorias] = await Promise.all([
    db.cuenta.findMany({
      where: { OR: [{ archivada: false }, { id: { in: [m.cuentaId ?? "", m.cuentaDestinoId ?? ""] } }] },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, moneda: true },
    }),
    db.categoria.findMany({
      where: { OR: [{ archivada: false }, { id: m.categoriaId ?? "" }] },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={TIPOS_MOVIMIENTO[m.tipo]} volver="/movimientos" />

      <Card className="gap-2 text-sm">
        {m.activo && (
          <p>
            Activo: <Link href={`/activos/${m.activo.id}`} className="font-medium underline">{m.activo.nombre}</Link>
          </p>
        )}
        {m.pasivo && (
          <p>
            Pasivo: <Link href={`/pasivos/${m.pasivo.id}`} className="font-medium underline">{m.pasivo.nombre}</Link>
          </p>
        )}
        {m.cuota && (
          <p className="text-muted-foreground">
            Vinculado a la cuota {m.cuota.numero} ({formatFechaMedia(m.cuota.fechaVencimiento)}). Si cambiás el monto o lo borrás, la cuota se recalcula.
          </p>
        )}
        <p className="text-muted-foreground">TC del día: ARS {formatNumero(m.tipoCambio)} por USD</p>
      </Card>

      {m.esDeVenta ? (
        <p className="bg-card rounded-xl border p-4 text-sm">
          Este movimiento es parte de la venta del activo. Para corregirlo, usá «Deshacer venta» desde el{" "}
          <Link href={`/activos/${m.activo?.id}`} className="underline">activo</Link>.
        </p>
      ) : (
        <>
          <FormMovimiento
            m={{
              id: m.id,
              tipo: m.tipo,
              fecha: m.fecha,
              monto: m.monto,
              moneda: m.moneda,
              cuentaId: m.cuentaId,
              cuentaDestinoId: m.cuentaDestinoId,
              montoDestino: m.montoDestino,
              categoriaId: m.categoriaId,
              descripcion: m.descripcion,
              vinculado: m.activo !== null || m.pasivo !== null,
              gastoDeActivo: m.tipo === "GASTO" && m.activo !== null,
            }}
            cuentas={cuentas}
            categorias={categorias}
            hoy={hoy()}
          />
          <BotonConfirmado
            variant="ghost"
            className="text-negativo w-full"
            accion={eliminarMovimiento.bind(null, m.id)}
            confirmacion={m.cuota ? "¿Borrás este movimiento? La cuota vinculada vuelve a quedar impaga por este monto." : "¿Borrás este movimiento? No se puede recuperar."}
          >
            Borrar movimiento
          </BotonConfirmado>
        </>
      )}
    </section>
  );
}
