import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AppProviders } from "@/components/providers/app-providers";
import { APP_LOCALE, APP_METADATA } from "@/lib/constants/app";
import { CHUNK_RECOVERY_SCRIPT } from "@/lib/chunk-recovery";

import "./globals.css";

/**
 * Satoshi (Indian Type Foundry, licencia ITF FFL): la única tipografía de la web. Se aloja en local y se usan los
 * archivos tal cual (la licencia no permite modificarlos ni subirlos a repositorios públicos: ver
 * `app/fonts/satoshi/README.md`). Una fuente variable cubre todos los pesos (300–900), también en cursiva.
 */
const satoshi = localFont({
  src: [
    { path: "./fonts/satoshi/Satoshi-Variable.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-VariableItalic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
});

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
    <html lang={APP_LOCALE} className={`dark h-full antialiased ${satoshi.variable}`}>
      <head>
        {/* Primero de todo: si esta pestaña quedó en una versión anterior tras un despliegue, se recupera sola (ver lib/chunk-recovery.ts). */}
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
