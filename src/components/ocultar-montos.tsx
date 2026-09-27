"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTO_OCULTO, formatMonto } from "@/lib/dinero";
import { COOKIE_OCULTAR_MONTOS } from "@/lib/preferencias";
import type { Moneda } from "@/domain/fx";

const OcultarMontosContext = createContext<{ oculto: boolean; alternar: () => void }>({
  oculto: false,
  alternar: () => {},
});

export function OcultarMontosProvider({
  inicial,
  children,
}: {
  inicial: boolean;
  children: React.ReactNode;
}) {
  const [oculto, setOculto] = useState(inicial);
  const alternar = useCallback(() => {
    setOculto((prev) => {
      const nuevo = !prev;
      document.cookie = `${COOKIE_OCULTAR_MONTOS}=${nuevo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return nuevo;
    });
  }, []);
  return <OcultarMontosContext value={{ oculto, alternar }}>{children}</OcultarMontosContext>;
}

export function useOcultarMontos() {
  return useContext(OcultarMontosContext);
}

export function BotonOcultarMontos() {
  const { oculto, alternar } = useOcultarMontos();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar montos" : "Ocultar montos"}
    >
      {oculto ? <EyeOff /> : <Eye />}
    </Button>
  );
}

/** Muestra un monto con su moneda, o •••• si están ocultos. `valor` es un decimal en string. */
export function Monto({ valor, moneda, className }: { valor: string; moneda: Moneda; className?: string }) {
  const { oculto } = useOcultarMontos();
  return (
    <span className={className} data-monto>
      {oculto ? `${moneda} ${MONTO_OCULTO}` : formatMonto(valor, moneda)}
    </span>
  );
}
