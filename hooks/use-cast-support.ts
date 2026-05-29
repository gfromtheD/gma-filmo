"use client";

import { useEffect, useState } from "react";

export function useCastSupport(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    // W3C Remote Playback API — Chrome (Cast) and some Chromium browsers
    const probe = document.createElement("video");
    if ("remote" in probe) { setAvailable(true); return; }

    // Safari AirPlay
    if ("WebKitPlaybackTargetAvailabilityEvent" in window) { setAvailable(true); return; }

    // Google Cast SDK (if loaded externally)
    const w = window as { chrome?: { cast?: unknown } };
    if (w.chrome?.cast) setAvailable(true);
  }, []);

  return available;
}
