import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonConfirmado } from "@/components/boton-confirmado";
import { BotonArchivar } from "@/components/config/boton-archivar";
import { FormCuenta } from "@/components/config/form-cuenta";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { evaluarEliminacion } from "@/domain/borrado";
import { formatNumero } from "@/lib/dinero";
import { archivarCuenta, eliminarCuenta } from "@/server/acciones/config";
import { db } from "@/server/db";
import { deFechaDb } from "@/server/fechas-db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Editar cuenta" };

export default async function EditarCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await db.cuenta.findUnique({ where: { id } });
  if (!c) notFound();
  const movimientos = await db.movimiento.count({ where: { OR: [{ cuentaId: id }, { cuentaDestinoId: id }] } });
  const eliminacion = evaluarEliminacion({ movimientos });
  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo={c.nombre} volver="/config/cuentas" />
      <FormCuenta
        cuenta={{
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          moneda: c.moneda,
          saldoInicial: formatNumero(c.saldoInicial.toString()),
          fechaSaldoInicial: deFechaDb(c.fechaSaldoInicial),
        }}
      />
      <BotonArchivar archivado={c.archivada} accion={archivarCuenta.bind(null, c.id)} cosa="esta cuenta" />
      {eliminacion.permitido ? (
        <BotonConfirmado
          variant="ghost"
          className="text-negativo w-full"
          accion={eliminarCuenta.bind(null, c.id)}
          confirmacion="¿Eliminás esta cuenta? No se puede recuperar. Usalo solo si la cargaste por error."
        >
          Eliminar (cargada por error)
        </BotonConfirmado>
      ) : (
        <p className="text-muted-foreground text-center text-xs">{eliminacion.motivo}</p>
      )}
    </section>
  );
}
