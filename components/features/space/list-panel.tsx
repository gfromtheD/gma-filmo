"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { workPath } from "@/lib/catalog/work-path";
import { DropdownMenu } from "radix-ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, EditPencil, List, NavArrowDown, Trash, Xmark } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import { LIST_NAME_MAX } from "@/lib/lists/rules";
import type { RatingEntry } from "@/hooks/use-ratings";
import type { MovieMedia } from "@/types/catalog";
import { AddToListMenu } from "./add-to-list-menu";
import { DiaryList } from "./diary-list";
import { RemoveFromListButton } from "./remove-from-list-button";
import type { Collection } from "./list-shelf";

type SortId = "recientes" | "titulo" | "anio";
const SORTS: readonly { id: SortId; label: string }[] = [
  { id: "recientes", label: "Añadidas recientemente" },
  { id: "titulo", label: "Título" },
  { id: "anio", label: "Año" },
];

function sortItems(items: readonly MovieMedia[], sort: SortId): readonly MovieMedia[] {
  if (sort === "titulo") return [...items].sort((a, b) => a.title.localeCompare(b.title, "es"));
  if (sort === "anio") return [...items].sort((a, b) => (b.year || 0) - (a.year || 0));
  return items;
}

const EMPTY_TEXT: Record<Collection["kind"], { title: string; body: string }> = {
  saved: { title: "Aún no has guardado nada", body: "Pulsa Guardar en cualquier corto y lo tendrás aquí para verlo cuando quieras." },
  rated: { title: "Todavía no has valorado ninguna obra", body: "Cuando valores lo que ves, aquí tendrás tu diario con tus notas y reseñas." },
  custom: { title: "Esta lista está vacía", body: "Añade obras desde su ficha o desde Guardados con el botón de listas." },
};

interface Props {
  readonly collection: Collection;
  readonly ratingEntries: Record<number, RatingEntry>;
  readonly onRemove: (item: MovieMedia) => void;
  readonly onRename: (name: string) => Promise<string | null>;
  readonly onDelete: () => void;
  readonly onEditRating: (item: MovieMedia) => void;
  readonly onRemoveRating: (item: MovieMedia) => void;
  readonly onError: (message: string) => void;
}

/** Contenido de la colección elegida en la estantería: carteles (o el diario, en Valoradas) y sus acciones. */
export function ListPanel({ collection, ratingEntries, onRemove, onRename, onDelete, onEditRating, onRemoveRating, onError }: Props) {
  const reduceMotion = useReducedMotion();
  const [sort, setSort] = useState<SortId>("recientes");
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(collection.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isCustom = collection.kind === "custom";
  const items = sortItems(collection.items, sort);
  const empty = EMPTY_TEXT[collection.kind];

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    const failure = await onRename(draftName);
    if (failure) { setRenameError(failure); return; }
    setIsRenaming(false);
  }

  return (
    <section id="mi-lista-panel" role="tabpanel" aria-label={collection.name}
      className="rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {isRenaming ? (
          <form onSubmit={(e) => void handleRename(e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input autoFocus value={draftName} maxLength={LIST_NAME_MAX + 10} aria-label="Nuevo nombre de la lista"
              onChange={(e) => { setDraftName(e.target.value); setRenameError(null); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setIsRenaming(false); setDraftName(collection.name); setRenameError(null); } }}
              className="min-w-0 max-w-[360px] flex-1 rounded-[10px] border border-[#22B16B]/50 bg-black/50 px-3 py-1.5 text-[22px] font-semibold text-white outline-none" />
            <button type="submit" aria-label="Guardar nombre" className="grid size-10 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] hover:bg-[#2AC57A]"><Check className="size-4" /></button>
            <button type="button" aria-label="Cancelar" onClick={() => { setIsRenaming(false); setDraftName(collection.name); setRenameError(null); }}
              className="grid size-10 place-items-center rounded-full text-[#A8A8A8] hover:bg-white/10 hover:text-white"><Xmark className="size-4" /></button>
            {renameError && <p role="alert" className="w-full text-[12.5px] text-[#ff7b7b]">{renameError}</p>}
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold tracking-[-0.01em] text-white">{collection.name}</h2>
            <p className="text-[13px] tabular-nums text-[#8A8A8A]">{collection.items.length} {collection.items.length === 1 ? "obra" : "obras"}</p>
          </div>
        )}

        {!isRenaming && (
          <div className="flex items-center gap-1">
            {collection.kind !== "rated" && collection.items.length > 1 && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="group inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-2 text-[13.5px] font-semibold text-[#C4C4C4] hover:text-white focus-visible:outline-2 focus-visible:outline-white data-[state=open]:text-white">
                  {SORTS.find((s) => s.id === sort)!.label}
                  <NavArrowDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6}
                    className="z-50 min-w-[220px] rounded-[14px] border border-white/10 bg-[#0C1611]/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                    <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => setSort(v as SortId)}>
                      {SORTS.map((s) => (
                        <DropdownMenu.RadioItem key={s.id} value={s.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[14px] text-white outline-none data-[highlighted]:bg-white/[0.08]">
                          {s.label}
                          <DropdownMenu.ItemIndicator><Check className="size-4 text-[#5FD39A]" /></DropdownMenu.ItemIndicator>
                        </DropdownMenu.RadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            {isCustom && !isConfirmingDelete && (
              <>
                <button type="button" onClick={() => { setDraftName(collection.name); setIsRenaming(true); }} aria-label="Renombrar lista" title="Renombrar"
                  className="grid size-10 place-items-center rounded-full text-[#A8A8A8] transition-colors hover:bg-white/10 hover:text-white"><EditPencil className="size-[18px]" /></button>
                <button type="button" onClick={() => setIsConfirmingDelete(true)} aria-label="Borrar lista" title="Borrar lista"
                  className="grid size-10 place-items-center rounded-full text-[#A8A8A8] transition-colors hover:bg-[#ff5252]/10 hover:text-[#ff7b7b]"><Trash className="size-[18px]" /></button>
              </>
            )}
            {isCustom && isConfirmingDelete && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-full border border-[#ff5252]/30 bg-[#ff5252]/[0.07] py-1 pl-4 pr-1 text-[13px] text-[#ffb3b3]">
                ¿Borrar la lista? Las obras no se borran.
                <button type="button" onClick={() => setIsConfirmingDelete(false)} className="min-h-8 rounded-[4px] px-3 font-semibold text-[#C4C4C4] hover:text-white">No</button>
                <button type="button" onClick={onDelete} className="min-h-8 rounded-[4px] bg-[#ff5252] px-3 font-bold text-white hover:bg-[#ff6b6b]">Borrar</button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="mt-6">
        {collection.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[16px] border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-[16px] font-semibold text-white">{empty.title}</p>
            <p className="mt-1.5 max-w-[42ch] text-[14px] leading-6 text-[#A8A8A8]">{empty.body}</p>
            <Link href="/cortos" className="mt-5 inline-flex min-h-11 items-center rounded-[4px] bg-[#22B16B] px-5 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]">
              Explorar cortos
            </Link>
          </div>
        ) : collection.kind === "rated" ? (
          <DiaryList items={collection.items} entries={ratingEntries} onEdit={onEditRating} onRemove={onRemoveRating} />
        ) : (
          <ul className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))" }}>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li key={item.id} layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                  className="group relative">
                  <Link href={workPath(item)} className="block rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    <span className="block overflow-hidden rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none">
                      <PosterArt style={item.style} title={item.title} kind="movie" ratio="portrait" imageUrl={item.imageUrl} />
                    </span>
                    <span className="mt-2 block truncate text-[13.5px] font-semibold text-[#E0E0E0]">{item.title}</span>
                    {item.year ? <span className="block text-[12px] tabular-nums text-[#7C7C7C]">{item.year}</span> : null}
                  </Link>
                  <div className="absolute right-0 top-0 flex opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <AddToListMenu numericId={item.numericId} title={item.title} onError={onError}>
                      <button type="button" aria-label={`Añadir «${item.title}» a una lista`} title="Añadir a una lista"
                        className="flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-white">
                        <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-[#5FD39A]">
                          <List className="size-4" />
                        </span>
                      </button>
                    </AddToListMenu>
                    <RemoveFromListButton onRemove={() => onRemove(item)} label={collection.kind === "saved" ? "Quitar de Mi Lista" : `Quitar de ${collection.name}`} />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
