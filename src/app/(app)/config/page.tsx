import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, DollarSign, Layers, Tags, Users, Wallet } from "lucide-react";
import { requireSession } from "@/server/sesion";

export const metadata: Metadata = { title: "Configuración" };

const secciones = [
  { href: "/config/cuentas", titulo: "Cuentas", detalle: "Efectivo, bancos, billeteras y brokers", icono: Wallet },
  { href: "/config/categorias", titulo: "Categorías", detalle: "Ingresos y gastos personales", icono: Tags },
  { href: "/config/tipos-activo", titulo: "Tipos de activo", detalle: "Cómo se registra cada activo", icono: Layers },
  { href: "/config/contrapartes", titulo: "Contrapartes", detalle: "Inversores y deudores", icono: Users },
  { href: "/config/tipo-cambio", titulo: "Tipo de cambio", detalle: "Oficial venta y carga manual", icono: DollarSign },
];

export default async function ConfigPage() {
  await requireSession();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      <ul className="bg-card divide-y rounded-xl border">
        {secciones.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center gap-3 p-4">
              <s.icono className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.titulo}</p>
                <p className="text-muted-foreground truncate text-sm">{s.detalle}</p>
              </div>
              <ChevronRight className="text-muted-foreground size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
