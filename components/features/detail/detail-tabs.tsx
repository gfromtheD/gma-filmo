"use client";

import type { KeyboardEvent } from "react";

export interface DetailTabItem<T extends string> {
  readonly id: T;
  readonly label: string;
}

interface DetailTabsProps<T extends string> {
  readonly tabs: readonly DetailTabItem<T>[];
  readonly activeId: T;
  readonly onChange: (id: T) => void;
  readonly idPrefix: string;
}

/** Id del panel asociado a una pestaña (para `aria-controls`/`aria-labelledby`). */
export function detailPanelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA): foco itinerante, flechas, Inicio y Fin.
 * Desplazables en horizontal cuando no caben.
 */
export function DetailTabs<T extends string>({ tabs, activeId, onChange, idPrefix }: DetailTabsProps<T>) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onChange(target.id);
    document.getElementById(`${idPrefix}-tab-${target.id}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Secciones de la ficha"
      className="flex gap-6 overflow-x-auto border-b border-white/10 px-4 [scrollbar-width:none] lg:px-16 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={detailPanelId(idPrefix, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`relative h-[60px] shrink-0 px-1 text-[16px] font-extrabold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[#22B16B] ${
              isActive ? "text-white after:opacity-100" : "text-white/70 hover:text-white after:opacity-0"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
