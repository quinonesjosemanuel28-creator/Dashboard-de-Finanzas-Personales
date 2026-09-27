"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (solo en producción). */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app funciona igual; solo pierde la pantalla offline.
    });
  }, []);
  return null;
}
