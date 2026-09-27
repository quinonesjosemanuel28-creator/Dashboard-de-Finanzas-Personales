"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, HandCoins, Home, Landmark, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/activos", label: "Activos", icon: HandCoins },
  { href: "/cargar", label: "Cargar", icon: Plus, destacado: true },
  { href: "/pasivos", label: "Pasivos", icon: Landmark },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
] as const;

export function NavInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icono = item.icon;
          if ("destacado" in item) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-label="Cargar movimiento"
                  className="bg-primary text-primary-foreground -mt-5 flex size-14 items-center justify-center rounded-full shadow-lg ring-4 ring-background"
                >
                  <Icono className="size-7" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  activo ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icono className={cn("size-5", activo && "text-positivo")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
