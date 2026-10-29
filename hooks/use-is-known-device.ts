"use client";

import { useEffect, useState } from "react";

/** Este navegador ya tuvo una sesión real aquí alguna vez (cookie propia, ver supabase-auth-provider). */
export function useIsKnownDevice(): boolean {
  const [isKnown, setIsKnown] = useState(false);

  useEffect(() => {
    setIsKnown(
      document.cookie.split(";").some((c) => c.trim().startsWith("gma_known_device=1")),
    );
  }, []);

  return isKnown;
}
