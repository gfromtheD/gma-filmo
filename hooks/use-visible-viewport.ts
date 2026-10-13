"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Bounds for fixed dialogs when a phone keyboard reduces the visible screen. */
export function useVisibleViewport(active = true): CSSProperties {
  const [bounds, setBounds] = useState<CSSProperties>({});
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      setBounds({
        top: viewport?.offsetTop ?? 0,
        left: viewport?.offsetLeft ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height,
        right: "auto", bottom: "auto",
        "--visible-viewport-height": `${height}px`,
      } as CSSProperties);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [active]);
  return bounds;
}
