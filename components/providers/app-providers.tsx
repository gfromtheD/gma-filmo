"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseAuthProvider } from "@/components/providers/supabase-auth-provider";
import { UserProfileProvider } from "@/components/providers/user-profile-provider";
import { ProfileTransitionOverlay } from "@/components/ui/profile-transition-overlay";

interface AppProvidersProps {
  readonly children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SupabaseAuthProvider>
      <UserProfileProvider>
        <TooltipProvider>
          {children}
          <ProfileTransitionOverlay />
        </TooltipProvider>
      </UserProfileProvider>
    </SupabaseAuthProvider>
  );
}
