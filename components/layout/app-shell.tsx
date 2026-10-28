import { Navbar } from "@/components/layout/navbar";
import { SiteAurora } from "@/components/layout/site-aurora";
import { SiteFooter } from "@/components/layout/site-footer";
import { UploadGuard } from "@/components/layout/upload-guard";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <SiteAurora />
      <Navbar />
      <main className="min-w-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">{children}</main>
      {/* Pie de página (fuera de <main>, para que sea el «contentinfo» de la página). En páginas cortas se queda abajo
          del todo. En el móvil la navegación es un panel lateral (MobileNavDrawer, en la cabecera): no hay barra que tape. */}
      <SiteFooter insetClassName="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]" />
      <UploadGuard />
    </div>
  );
}
