"use client";

import { useEffect, useState } from "react";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";

export function useIsGuest(): boolean {
  const userId = useSupabaseUserId();
  const [hasCookie, setHasCookie] = useState(false);

  useEffect(() => {
    setHasCookie(
      document.cookie.split(";").some((c) => c.trim().startsWith("gma_guest=1")),
    );
  }, []);

  return !userId && hasCookie;
}
