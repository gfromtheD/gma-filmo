"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseAuthProvider } from "@/components/providers/supabase-auth-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";

interface AppProvidersProps {
  readonly children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SupabaseAuthProvider>
      <UserProfileProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </UserProfileProvider>
    </SupabaseAuthProvider>
  );
}
