"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useTransitionStore } from "@/store/use-transition-store";

export function ProfileTransitionOverlay() {
  const pathname    = usePathname();
  const phase       = useTransitionStore((s) => s.phase);
  const origin      = useTransitionStore((s) => s.origin);
  const size        = useTransitionStore((s) => s.size);
  const chipPos     = useTransitionStore((s) => s.chipPos);
  const startContract = useTransitionStore((s) => s.startContract);
  const reset       = useTransitionStore((s) => s.reset);

  // Once we land on /inicio while the circle is still expanding → start contraction
  useEffect(() => {
    if (phase === "expanding" && pathname === "/inicio") {
      const t = setTimeout(startContract, 80);
      return () => clearTimeout(t);
    }
  }, [phase, pathname, startContract]);

  if (phase === "idle") return null;

  if (phase === "expanding") {
    return (
      <motion.div
        key="expand"
        style={{
          position: "fixed",
          borderRadius: "50%",
          background: "#22B16B",
          left: origin.x,
          top: origin.y,
          x: "-50%",
          y: "-50%",
          zIndex: 9999,
          pointerEvents: "none",
        }}
        initial={{ width: 140, height: 140 }}
        animate={{ width: size, height: size }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    );
  }

  // Contracting phase — starts full-screen, shrinks to chip
  const cx = typeof window !== "undefined" ? window.innerWidth / 2  : 760;
  const cy = typeof window !== "undefined" ? window.innerHeight / 2 : 400;

  return (
    <motion.div
      key="contract"
      style={{
        position: "fixed",
        borderRadius: "50%",
        background: "#22B16B",
        x: "-50%",
        y: "-50%",
        zIndex: 9999,
        pointerEvents: "none",
      }}
      initial={{ left: cx, top: cy, width: size, height: size }}
      animate={{ left: chipPos.x, top: chipPos.y, width: 28, height: 28 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={reset}
    />
  );
}
