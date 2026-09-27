import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Instalar la app" };

export default async function InstalarPage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Instalá la app</h1>
      <p className="text-muted-foreground text-sm">
        Instalada, abre en pantalla completa como cualquier app del celular.
      </p>
      <Card>
        <CardHeader className="font-semibold">iPhone (Safari)</CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Abrí esta página en Safari.</li>
            <li>Tocá el botón Compartir (el cuadrado con la flecha hacia arriba).</li>
            <li>Elegí «Agregar a pantalla de inicio» y confirmá con «Agregar».</li>
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="font-semibold">Android (Chrome)</CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Abrí esta página en Chrome.</li>
            <li>Tocá el menú ⋮ de arriba a la derecha.</li>
            <li>Elegí «Instalar app» (o «Agregar a pantalla principal»).</li>
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
