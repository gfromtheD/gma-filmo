"use client";

import { useEffect, useState } from "react";

/** La hora actual (ms), refrescada cada `intervalMs`; con `null` no hay reloj y se queda la del montaje. */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
