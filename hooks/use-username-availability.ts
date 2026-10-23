"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { usernameProblem } from "@/lib/profiles/username";

export type UsernameAvailability = "idle" | "checking" | "free" | "taken";

/** Espera tras la última tecla antes de preguntar si el @ está libre. */
const AVAILABILITY_DELAY_MS = 400;

/**
 * Mientras se escribe: ¿el @ (ya normalizado) es válido y está libre? Pregunta a la base de datos (`username_available`;
 * el @ propio cuenta como libre). `idle` si no hay nada que comprobar o si la consulta falla.
 */
export function useUsernameAvailability(candidate: string, current: string): UsernameAvailability {
  const [state, setState] = useState<UsernameAvailability>("idle");
  useEffect(() => {
    if (candidate === current || usernameProblem(candidate)) { setState("idle"); return; }
    setState("checking");
    let cancelled = false;
    const timer = setTimeout(() => {
      void getSupabaseBrowserClient().rpc("username_available", { candidate }).then(({ data, error }) => {
        if (!cancelled) setState(error ? "idle" : data ? "free" : "taken");
      });
    }, AVAILABILITY_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [candidate, current]);
  return state;
}
