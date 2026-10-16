"use client";

import { STUDIO_TABS } from "./studio-sub-nav";
import type { StudioTabId } from "./studio-types";

interface StudioSidebarProps {
  readonly active: StudioTabId;
  readonly onSelect: (id: StudioTabId) => void;
}

/** Barra lateral de Mi Estudio (escritorio). En móvil las secciones salen en la fila de la cabecera. */
export function StudioSidebar({ active, onSelect }: StudioSidebarProps) {
  return (
    <nav aria-label="Mi Estudio" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
      <ul className="flex flex-col gap-1">
        {STUDIO_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-11 w-full items-center gap-3 rounded-[8px] px-3.5 text-left text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                  isActive ? "bg-white/10 text-white" : "text-[#C4C4C4] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span aria-hidden="true" className={isActive ? "text-[#22B16B]" : ""}>{tab.icon}</span>
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
