"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useTransitionStore } from "@/store/use-transition-store";

function getGreeting(isFirstVisit: boolean): string {
  if (isFirstVisit) return "Bienvenido,";
  const hour = new Date().getHours();
  const morning   = ["Buenos días,", "Hola,", "Hola de nuevo,"];
  const afternoon = ["Buenas tardes,", "Hola,", "Hola de nuevo,"];
  const night     = ["Buenas noches,", "Hola,", "Hola de nuevo,"];
  const pool =
    hour >= 5 && hour < 12 ? morning :
    hour >= 12 && hour < 19 ? afternoon :
    night;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function ProfileTransitionOverlay() {
  const pathname      = usePathname();
  const phase         = useTransitionStore((s) => s.phase);
  const origin        = useTransitionStore((s) => s.origin);
  const size          = useTransitionStore((s) => s.size);
  const chipPos       = useTransitionStore((s) => s.chipPos);
  const profileName   = useTransitionStore((s) => s.profileName);
  const isFirstVisit  = useTransitionStore((s) => s.isFirstVisit);
  const startContract = useTransitionStore((s) => s.startContract);
  const reset         = useTransitionStore((s) => s.reset);

  const [textFading, setTextFading] = useState(false);

  useEffect(() => {
    if (phase !== "expanding" || pathname !== "/inicio") return;
    // Text starts fading immediately on landing (fade duration: 550ms)
    setTextFading(true);
    // Contraction starts after text is fully gone + small buffer
    const t = setTimeout(startContract, 680);
    return () => clearTimeout(t);
  }, [phase, pathname, startContract]);

  useEffect(() => {
    if (phase === "idle") setTextFading(false);
  }, [phase]);

  if (phase === "idle") return null;

  const cx = typeof window !== "undefined" ? window.innerWidth / 2  : 760;
  const cy = typeof window !== "undefined" ? window.innerHeight / 2 : 400;

  return (
    <>
      {/* Expanding circle */}
      {phase === "expanding" && (
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
          transition={{ duration: 1.6, ease: [0.42, 0, 0.58, 1] }}
        />
      )}

      {/* Contracting circle */}
      {phase === "contracting" && (
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
          transition={{ duration: 1.2, ease: [0.34, 1, 0.64, 1] }}
          onAnimationComplete={reset}
        />
      )}

      {/* Welcome text — fades out before contraction starts */}
      <AnimatePresence>
        {phase === "expanding" && !textFading && (
          <motion.div
            key="welcome"
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              pointerEvents: "none",
              gap: 8,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.75, duration: 0.55, ease: "easeInOut" }}
          >
            {profileName ? (
              <>
                <span style={{
                  color: "rgba(3,26,14,0.5)",
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}>
                  {getGreeting(isFirstVisit)}
                </span>
                <span style={{
                  color: "#031A0E",
                  fontSize: 120,
                  fontFamily: "var(--font-serif), 'Instrument Serif', Georgia, serif",
                  fontStyle: "italic",
                  lineHeight: 1.0,
                  fontWeight: 400,
                }}>
                  {profileName}
                </span>
              </>
            ) : (
              <span style={{
                color: "#031A0E",
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}>
                Bienvenido a GMA Filmo
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
