"use client";

import { useEffect, useState } from "react";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useIsCreator(): { isCreator: boolean; isLoading: boolean } {
  const userId = useSupabaseUserId();
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsCreator(false);
      setIsLoading(false);
      return;
    }
    getSupabaseBrowserClient()
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsCreator(data != null);
        setIsLoading(false);
      });
  }, [userId]);

  return { isCreator, isLoading };
}
