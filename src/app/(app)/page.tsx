import { Monto } from "@/components/ocultar-montos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/server/sesion";

export default async function InicioPage() {
  const session = await requireSession();
  const nombre = session.user?.name?.split(" ")[0];

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tu patrimonio neto</CardTitle>
          <Monto valor="0" moneda="USD" className="text-3xl font-semibold tracking-tight" />
        </CardHeader>
        <CardContent>
          <CardDescription>Todavía no cargaste cuentas, activos ni pasivos.</CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
