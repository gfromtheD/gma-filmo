import { Navbar } from "@/components/layout/navbar";
import { DMWindow } from "@/components/features/dm/dm-window";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh min-w-0 bg-[#000000]">
      <Navbar />
      <main className="min-w-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">{children}</main>
      <DMWindow />
    </div>
  );
}
