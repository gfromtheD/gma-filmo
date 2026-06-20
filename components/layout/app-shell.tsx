import { Navbar } from "@/components/layout/navbar";
import { DMWindow } from "@/components/features/dm/dm-window";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#000000]">
      <Navbar />
      <main>{children}</main>
      <DMWindow />
    </div>
  );
}
