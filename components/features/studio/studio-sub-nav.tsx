"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Folders, CloudUpload, BarChart2, User } from "lucide-react";
import { C, row } from "./studio-ui";
import type { StudioTabId } from "./studio-types";

export const STUDIO_TABS: { id: StudioTabId; label: string; icon: React.ReactNode }[] = [
  { id: "inicio",       label: "Panel",        icon: <LayoutDashboard size={15} /> },
  { id: "titulos",      label: "Mis títulos",  icon: <Folders size={15} /> },
  { id: "subir",        label: "Subir",        icon: <CloudUpload size={15} /> },
  { id: "estadisticas", label: "Estadísticas", icon: <BarChart2 size={15} /> },
  { id: "perfil",       label: "Perfil",       icon: <User size={15} /> },
];

export function StudioSubNav({
  active,
  onTabChange,
}: {
  active: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
}) {
  const tabRefs                   = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill]           = useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = useState(false);

  useEffect(() => {
    const idx = STUDIO_TABS.findIndex((t) => t.id === active);
    const el  = tabRefs.current[idx];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    setPillReady(true);
  }, [active]);

  return (
    <div
      style={{
        position: "relative", display: "inline-flex",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 999,
      }}
    >
      {pillReady && (
        <motion.div
          style={{ position: "absolute", top: 3, bottom: 3, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}
          animate={{ left: pill.left, width: pill.width }}
          transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.7 }}
        />
      )}
      {STUDIO_TABS.map((t, i) => {
        const isAct = active === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => onTabChange(t.id)}
            style={{
              ...row(7),
              height: 40, padding: "0 18px",
              border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              background: "transparent",
              color: isAct ? "#fff" : C.textMuted,
              borderRadius: 999,
              position: "relative", zIndex: 1,
              transition: "color 0.18s ease",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
