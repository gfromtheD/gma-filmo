import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "./back-button";

export const metadata: Metadata = { title: "GMA Filmo" };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#060C14", color: "#fff" }}>
      {/* Minimal header — just the logo, no nav */}
      <header style={{ padding: "32px 40px 0" }}>
        <BackButton />
      </header>
      {children}
    </div>
  );
}
