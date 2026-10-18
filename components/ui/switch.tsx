"use client";

import { motion, useReducedMotion } from "motion/react";

/** Interruptor con el tirador deslizándose con un muelle suave. La zona pulsable mide 44 px de alto. */
export function Switch({ label, checked, onChange }: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="group flex h-11 shrink-0 items-center focus-visible:outline-none">
      <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-white ${checked ? "justify-end bg-[#22B16B]" : "justify-start bg-white/15"}`}>
        <motion.span layout={!reduceMotion} transition={{ type: "spring", stiffness: 520, damping: 34 }} className="size-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
      </span>
    </button>
  );
}
