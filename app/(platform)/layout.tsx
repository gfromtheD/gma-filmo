import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

interface PlatformLayoutProps {
  readonly children: React.ReactNode;
}

export default function PlatformLayout({ children }: PlatformLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
