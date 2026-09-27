import Link from "next/link";
import { ArrowLeftRight, Download, LogOut, Menu, Settings } from "lucide-react";
import { signOut } from "@/auth";
import { BotonOcultarMontos } from "@/components/ocultar-montos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Encabezado() {
  async function cerrarSesion() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-2">
        <Link href="/" className="px-2 text-lg font-semibold tracking-tight">
          Patrimonio
        </Link>
        <div className="flex items-center">
          <BotonOcultarMontos />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menú">
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/movimientos">
                  <ArrowLeftRight /> Movimientos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/config">
                  <Settings /> Configuración
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/instalar">
                  <Download /> Instalar la app
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={cerrarSesion}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOut /> Cerrar sesión
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
