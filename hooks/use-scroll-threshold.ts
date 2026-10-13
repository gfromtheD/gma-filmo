"use client";

import { useEffect, useState } from "react";

/** `true` cuando la página se ha desplazado más de `threshold` px. */
export function useScrollThreshold(threshold = 8): boolean {
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setIsPast(window.scrollY > threshold);
    };
    const handleScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return isPast;
}
