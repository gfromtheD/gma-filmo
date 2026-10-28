import { Navbar } from "@/components/layout/navbar";
import { SiteAurora } from "@/components/layout/site-aurora";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { UploadGuard } from "@/components/layout/upload-guard";
import { TAB_BAR_HEIGHT_PX } from "@/lib/constants/layout";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="flex min-h-dvh min-w-0 flex-col"
      style={{ ["--gma-tabbar-h" as string]: `${TAB_BAR_HEIGHT_PX}px` }}
    >
      <SiteAurora />
      <Navbar />
      <main className="min-w-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">{children}</main>
      {/* Pie de página (fuera de <main>, para que sea el «contentinfo» de la página). En páginas cortas se queda abajo
          del todo. En móvil se reserva el alto de la barra inferior para que no tape el final. */}
      <SiteFooter insetClassName="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[calc(var(--gma-tabbar-h)+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)]" />
      <MobileTabBar />
      <UploadGuard />
    </div>
  );
}
