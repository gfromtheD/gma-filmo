"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface StudioTabsRowTab<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon: ReactNode;
}

interface StudioTabsRowProps<T extends string> {
  readonly tabs: readonly StudioTabsRowTab<T>[];
  readonly activeId: T;
  readonly onSelect: (id: T) => void;
}

/**
 * Sub-navegación de Mi Estudio para anchos < lg: fila horizontal desplazable
 * bajo la cabecera. Solo presentación; el estado vive en el store de Studio.
 */
export function StudioTabsRow<T extends string>({ tabs, activeId, onSelect }: StudioTabsRowProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rowRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <div className="relative border-t border-[#1C1C1C] lg:hidden">
      <div
        ref={rowRef}
        role="group"
        aria-label="Secciones de Mi Estudio"
        className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:px-4"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => onSelect(tab.id)}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${
                isActive ? "bg-[#22B16B]/10 text-[#22B16B]" : "text-[#B8C5D4] hover:bg-[#1A1A1A] hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
