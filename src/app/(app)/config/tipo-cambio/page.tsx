import type { Metadata } from "next";
import { FormTc } from "@/components/config/form-tc";
import { EncabezadoPagina } from "@/components/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tcDesactualizado } from "@/domain/fx";
import { formatNumero } from "@/lib/dinero";
import { formatFechaCorta } from "@/lib/etiquetas";
import { hoy } from "@/lib/hoy";
import { db } from "@/server/db";
import { deFechaDb } from "@/server/fechas-db";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Tipo de cambio" };

export default async function TipoCambioPage() {
  await requireSession();
  const ultimos = await db.tipoCambio.findMany({ orderBy: { fecha: "desc" }, take: 30 });
  const ultimo = ultimos[0];
  const desactualizado = tcDesactualizado(ultimo ? deFechaDb(ultimo.fecha) : null, hoy());

  return (
    <section className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Tipo de cambio" volver="/config" />
      <Card>
        <CardHeader>
          <CardTitle>Oficial venta vigente</CardTitle>
          {ultimo ? (
            <p className="text-3xl font-semibold tracking-tight">ARS {formatNumero(ultimo.venta.toString())}</p>
          ) : (
            <p className="text-muted-foreground">Todavía no hay tipo de cambio cargado.</p>
          )}
        </CardHeader>
        {ultimo && (
          <CardContent className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Del {formatFechaCorta(deFechaDb(ultimo.fecha))}</span>
            {ultimo.manual && <Badge>Manual</Badge>}
            {desactualizado && <Badge variant="aviso">Desactualizado</Badge>}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cargar a mano</CardTitle>
          <p className="text-muted-foreground text-sm">
            Si cargás un día que ya existe, se reemplaza y queda marcado como manual. La actualización automática diaria llega con el cron.
          </p>
        </CardHeader>
        <CardContent>
          <FormTc fecha={hoy()} />
        </CardContent>
      </Card>

      {ultimos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Últimos valores</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {ultimos.map((tc) => (
              <li key={tc.fecha.toISOString()} className="flex items-center justify-between gap-2 px-4 py-3">
                <span>{formatFechaCorta(deFechaDb(tc.fecha))}</span>
                <span className="text-muted-foreground flex items-center gap-2">
                  {tc.manual && <Badge>Manual</Badge>}
                  <span className="text-foreground tabular-nums">
                    {formatNumero(tc.compra.toString())} / {formatNumero(tc.venta.toString())}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">Compra / venta, en ARS por USD.</p>
        </div>
      )}
    </section>
  );
}
