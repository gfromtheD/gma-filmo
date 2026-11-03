import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/providers/app-providers";
import { APP_LOCALE, APP_METADATA } from "@/lib/constants/app";
import { CHUNK_RECOVERY_SCRIPT } from "@/lib/chunk-recovery";

import "./globals.css";

/**
 * Satoshi (Indian Type Foundry, licencia ITF FFL): la única tipografía de la web. Se sirve desde Fontshare, que es la vía que la
 * licencia permite sin redistribuir los archivos (no van al repositorio: ver `app/fonts/satoshi/README.md`). Una fuente variable
 * cubre todos los pesos (300–900), también en cursiva. `--font-satoshi` se define en `globals.css`; la CSP permite
 * `api.fontshare.com` (hoja de estilos) y `cdn.fontshare.com` (archivos).
 */
const SATOSHI_CSS = "https://api.fontshare.com/v2/css?f[]=satoshi@1,2&display=swap";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: {
    default: "GMA Filmo",
    template: "%s · GMA Filmo",
  },
  description: APP_METADATA.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={APP_LOCALE} className="dark h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={SATOSHI_CSS} />
        {/* Primero de todo: si esta pestaña quedó en una versión anterior tras un despliegue, se recupera sola (ver lib/chunk-recovery.ts). */}
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
