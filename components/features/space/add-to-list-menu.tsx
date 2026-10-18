"use client";

import { Popover } from "radix-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus } from "@/components/ui/icons";
import { useLists } from "@/hooks/use-lists";
import { LIST_NAME_MAX, listNameError } from "@/lib/lists/rules";

interface Props {
  readonly numericId: number;
  readonly title: string;
  /** El botón que abre el menú (se usa tal cual con `asChild`). */
  readonly children: ReactNode;
  readonly onError: (message: string) => void;
  readonly onLoginRequired?: () => void;
  readonly align?: "start" | "center" | "end";
}

/**
 * Menú para meter o sacar una obra de tus listas propias, con un campo para crear una lista nueva sin salir de aquí
 * (la obra entra directamente en ella).
 */
export function AddToListMenu({ numericId, title, children, onError, onLoginRequired, align = "end" }: Props) {
  const { lists, isLoaded, isAvailable, canUse, createList, toggleItem } = useLists();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next && !canUse) { onLoginRequired?.(); return; }
    setIsOpen(next);
    if (!next) { setNewName(""); setFieldError(null); }
  }

  async function handleToggle(listId: string) {
    const res = await toggleItem(listId, numericId);
    if (!res.ok) onError(res.error);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const invalid = listNameError(newName, lists.map((l) => l.name));
    if (invalid) { setFieldError(invalid); return; }
    setIsCreating(true);
    const res = await createList(newName);
    if (res.ok && res.list) {
      setNewName("");
      setFieldError(null);
      const added = await toggleItem(res.list.id, numericId);
      if (!added.ok) onError(added.error);
    } else if (!res.ok) {
      setFieldError(res.error);
    }
    setIsCreating(false);
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={8} collisionPadding={12} aria-label={`Añadir «${title}» a una lista`}
          className="z-[90] w-[280px] rounded-[16px] border border-white/10 bg-[#0C1611]/95 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <p className="px-2.5 pb-1.5 pt-1 text-[13px] font-semibold text-white">Añadir a una lista</p>
          {!isAvailable ? (
            <p className="px-2.5 pb-2 text-[12.5px] leading-5 text-[#A8A8A8]">Las listas propias no están disponibles ahora mismo. Inténtalo más tarde.</p>
          ) : (
            <>
              <ul className="max-h-[240px] overflow-y-auto">
                {!isLoaded && <li className="px-2.5 py-2 text-[12.5px] text-[#8A8A8A]">Cargando tus listas…</li>}
                {isLoaded && lists.length === 0 && (
                  <li className="px-2.5 py-2 text-[12.5px] leading-5 text-[#8A8A8A]">Aún no tienes listas. Crea la primera aquí abajo.</li>
                )}
                {lists.map((list) => {
                  const isIn = list.itemIds.includes(numericId);
                  return (
                    <li key={list.id}>
                      <button type="button" role="menuitemcheckbox" aria-checked={isIn} onClick={() => void handleToggle(list.id)}
                        className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none">
                        <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors ${isIn ? "border-[#22B16B] bg-[#22B16B] text-[#031A0E]" : "border-white/25"}`}>
                          {isIn && <Check className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] text-white">{list.name}</span>
                        <span className="text-[12px] tabular-nums text-[#7C7C7C]">{list.itemIds.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <form onSubmit={(e) => void handleCreate(e)} className="mt-1 border-t border-white/[0.07] px-1 pt-2">
                <div className="flex items-center gap-1.5">
                  <input value={newName} onChange={(e) => { setNewName(e.target.value); setFieldError(null); }} maxLength={LIST_NAME_MAX + 10}
                    placeholder="Nueva lista" aria-label="Nombre de la nueva lista" aria-invalid={fieldError ? true : undefined}
                    className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-black/40 px-3 py-2 text-[14px] text-white placeholder-[#7C7C7C] outline-none focus:border-[#22B16B]" />
                  <button type="submit" disabled={isCreating || !newName.trim()} aria-label="Crear lista y añadir"
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#22B16B] text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-40">
                    <Plus className="size-4" />
                  </button>
                </div>
                {fieldError && <p role="alert" className="px-1 pt-1.5 text-[12px] text-[#ff7b7b]">{fieldError}</p>}
              </form>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
