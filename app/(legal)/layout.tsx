import { SiteAurora } from "@/components/layout/site-aurora";
import { SiteFooter } from "@/components/layout/site-footer";
import { BackButton } from "./back-button";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>
      <SiteAurora />
      {/* Minimal header — just the logo, no nav */}
      <header style={{ padding: "32px 40px 0" }}>
        <BackButton />
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      <SiteFooter />
    </div>
  );
}
