import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { TAB_BAR_HEIGHT_PX } from "@/lib/constants/layout";
import { DMWindow } from "@/components/features/dm/dm-window";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh min-w-0 bg-[#060613]">
      <Navbar />
      {/* En móvil se reserva el alto de la barra inferior para que no tape el final de la página. */}
      <main
        className="min-w-0 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[calc(var(--gma-tabbar-h)+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)]"
        style={{ ["--gma-tabbar-h" as string]: `${TAB_BAR_HEIGHT_PX}px` }}
      >
        {children}
      </main>
      <MobileTabBar />
      <DMWindow />
    </div>
  );
}
