import type { Metadata, Viewport } from "next";
import { RegistrarServiceWorker } from "@/components/registrar-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Patrimonio", template: "%s · Patrimonio" },
  description: "Tus finanzas personales: activos, pasivos y patrimonio neto.",
  applicationName: "Patrimonio",
  appleWebApp: { capable: true, title: "Patrimonio", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141824" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
