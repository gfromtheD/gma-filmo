"use client";

import { DropdownMenu } from "radix-ui";
import { Check } from "@/components/ui/icons";
import { FOLDER_COLORS } from "@/lib/lists/folder-colors";

/** Botón con el color actual de la carpeta; al pulsarlo, la paleta para cambiarlo. */
export function FolderColorMenu({ color, onColor }: { readonly color: string; readonly onColor: (hex: string) => void }) {
  return (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger aria-label="Color de la carpeta" title="Color de la carpeta"
      className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white data-[state=open]:bg-white/10">
      <span aria-hidden="true" className="size-5 rounded-full ring-2 ring-white/70" style={{ background: color }} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={6}
        className="z-50 rounded-[8px] border border-white/10 bg-[#0C1611]/95 p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <p className="mb-2 px-0.5 text-[12.5px] font-semibold text-[#A8A8A8]">Color de la carpeta</p>
        <div className="grid grid-cols-4 gap-2">
          {FOLDER_COLORS.map((c) => (
            <DropdownMenu.Item key={c.id} onSelect={() => onColor(c.hex)} aria-label={c.label} title={c.label}
              className="grid size-10 cursor-pointer place-items-center rounded-full outline-none data-[highlighted]:bg-white/10">
              <span className="grid size-7 place-items-center rounded-full" style={{ background: c.hex }}>
                {c.hex.toLowerCase() === color.toLowerCase() && <Check className="size-4 text-white" />}
              </span>
            </DropdownMenu.Item>
          ))}
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
  );
}
