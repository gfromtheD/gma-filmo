"use client";

import { motion, useReducedMotion } from "motion/react";

/** Selector de opciones en píldora; la marca verde se desliza hasta la opción elegida. */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { id: T; label: string }[];
  readonly onChange: (value: T) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[6px] bg-white/[0.06] p-1">
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button key={option.id} type="button" role="radio" aria-checked={isSelected} onClick={() => onChange(option.id)}
            className={`relative min-h-9 rounded-[4px] px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white ${isSelected ? "text-[#031A0E]" : "text-[#C4C4C4] hover:text-white"}`}>
            {isSelected && (
              <motion.span layoutId={`seg-${label}`} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-[4px] bg-[#22B16B]" />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
