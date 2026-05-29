import type { Metadata } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { APP_LOCALE, APP_METADATA } from "@/lib/constants/app";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GMA Filmo",
    template: "%s — GMA Filmo",
  },
  description: APP_METADATA.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={APP_LOCALE} className={`dark h-full antialiased ${manrope.variable} ${instrumentSerif.variable}`}>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
