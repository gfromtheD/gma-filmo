"use client";

import { DropdownMenu } from "radix-ui";
import type { CommentSort } from "@/lib/comments/presentation";

const OPTIONS: readonly { readonly id: CommentSort; readonly label: string; readonly hint: string }[] = [
  { id: "top", label: "Destacados", hint: "Muestra primero los comentarios con más «De acuerdo»" },
  { id: "recent", label: "Más recientes", hint: "Muestra primero los comentarios más nuevos" },
];

interface CommentSortControlProps {
  readonly value: CommentSort;
  readonly onChange: (sort: CommentSort) => void;
}

/** Icono de ordenar: tres líneas que se acortan. */
function SortIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h11M4 18h6" />
    </svg>
  );
}

/**
 * «Ordenar por» (como YouTube): un botón con el icono de ordenar que abre un menú con «Destacados» y
 * «Más recientes». La opción activa lleva una marca y se anuncia como seleccionada.
 */
export function CommentSortControl({ value, onChange }: CommentSortControlProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="flex min-h-11 items-center gap-2.5 rounded-full px-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B] data-[state=open]:bg-white/10"
      >
        <SortIcon />
        Ordenar por
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(92vw,300px)] overflow-hidden rounded-2xl border border-white/10 bg-gma-surface p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as CommentSort)}>
            {OPTIONS.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className="relative flex cursor-pointer flex-col rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors data-[highlighted]:bg-white/10"
              >
                <DropdownMenu.ItemIndicator className="absolute left-3 top-3 text-[#22B16B]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </DropdownMenu.ItemIndicator>
                <span className="text-[15px] font-semibold text-white">{option.label}</span>
                <span className="text-[12.5px] leading-snug text-white/60">{option.hint}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
