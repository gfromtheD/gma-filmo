"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { Plus } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import { LIST_NAME_MAX, listNameError } from "@/lib/lists/rules";
import type { MovieMedia } from "@/types/catalog";

export type CollectionKind = "saved" | "rated" | "custom";

export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly kind: CollectionKind;
  readonly items: readonly MovieMedia[];
}

/** Portada de una colección: mosaico con sus cuatro primeros carteles, o un icono si está vacía. */
function Cover({ items, icon }: { readonly items: readonly MovieMedia[]; readonly icon: ReactNode }) {
  if (items.length === 0) {
    return (
      <div className="grid size-full place-items-center bg-[radial-gradient(120%_100%_at_0%_0%,rgba(34,177,107,0.22),transparent_60%),rgba(255,255,255,0.03)] text-[#5FD39A]">
        {icon}
      </div>
    );
  }
  const cells = items.slice(0, 4);
  return (
    <div className={`grid size-full gap-px bg-black ${cells.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {cells.map((item, i) => (
        <div key={item.id} className={`relative overflow-hidden ${cells.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          <PosterArt fill style={item.style} title="" kind="movie" imageUrl={item.imageUrl} />
        </div>
      ))}
    </div>
  );
}

const ICONS: Record<CollectionKind, ReactNode> = {
  saved: <GmaIcon name="bookmark" size={30} />,
  rated: <GmaIcon name="star" size={30} />,
  custom: <GmaIcon name="film" size={30} />,
};

const COUNT_LABEL: Record<CollectionKind, [string, string]> = {
  saved: ["guardada", "guardadas"],
  rated: ["valorada", "valoradas"],
  custom: ["obra", "obras"],
};

interface Props {
  readonly collections: readonly Collection[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly canCreate: boolean;
  readonly isCreating: boolean;
  readonly onStartCreate: () => void;
  readonly onCancelCreate: () => void;
  readonly onCreate: (name: string) => Promise<string | null>;
}

/**
 * Estantería de colecciones: Guardados, Valoradas y las listas propias, como portadas que se eligen para ver su
 * contenido debajo. La última casilla crea una lista nueva en el sitio.
 */
export function ListShelf({ collections, selectedId, onSelect, canCreate, isCreating, onStartCreate, onCancelCreate, onCreate }: Props) {
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const invalid = listNameError(name, collections.filter((c) => c.kind === "custom").map((c) => c.name));
    if (invalid) { setError(invalid); return; }
    setIsSaving(true);
    const failure = await onCreate(name);
    setIsSaving(false);
    if (failure) { setError(failure); return; }
    setName("");
    setError(null);
  }

  return (
    <div role="tablist" aria-label="Tus colecciones" className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 [scrollbar-width:none]">
      {collections.map((collection) => {
        const isSelected = collection.id === selectedId;
        const [one, many] = COUNT_LABEL[collection.kind];
        return (
          <motion.button key={collection.id} type="button" role="tab" aria-selected={isSelected} aria-controls="mi-lista-panel"
            onClick={() => onSelect(collection.id)} layout={!reduceMotion}
            className="group w-[150px] shrink-0 snap-start text-left focus-visible:outline-none sm:w-[170px]">
            <span className={`relative block aspect-square overflow-hidden rounded-[18px] transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-white motion-reduce:transition-none ${
              isSelected ? "shadow-[0_0_0_2px_#22B16B,0_18px_40px_-18px_rgba(34,177,107,0.8)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            }`}>
              <Cover items={collection.items} icon={ICONS[collection.kind]} />
            </span>
            <span className={`mt-2.5 block truncate text-[14.5px] font-semibold transition-colors ${isSelected ? "text-white" : "text-[#C4C4C4] group-hover:text-white"}`}>
              {collection.name}
            </span>
            <span className="block text-[12.5px] tabular-nums text-[#7C7C7C]">
              {collection.items.length} {collection.items.length === 1 ? one : many}
            </span>
          </motion.button>
        );
      })}

      {canCreate && (
        <div className="w-[150px] shrink-0 snap-start sm:w-[170px]">
          {isCreating ? (
            <form onSubmit={(e) => void handleSubmit(e)}
              className="flex aspect-square flex-col justify-center gap-2 rounded-[18px] border border-[#22B16B]/50 bg-[#22B16B]/[0.06] p-3">
              <label htmlFor="nueva-lista" className="text-[12.5px] font-semibold text-[#C4C4C4]">Nombre de la lista</label>
              <input id="nueva-lista" autoFocus value={name} maxLength={LIST_NAME_MAX + 10} placeholder="Para ver con amigos"
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Escape") { setName(""); setError(null); onCancelCreate(); } }}
                className="w-full rounded-[10px] border border-white/10 bg-black/50 px-2.5 py-2 text-[13.5px] text-white placeholder-[#6A6A6A] outline-none focus:border-[#22B16B]" />
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setName(""); setError(null); onCancelCreate(); }}
                  className="min-h-9 flex-1 rounded-full text-[12.5px] font-semibold text-[#A8A8A8] hover:text-white">Cancelar</button>
                <button type="submit" disabled={isSaving || !name.trim()}
                  className="min-h-9 flex-1 rounded-full bg-[#22B16B] text-[12.5px] font-bold text-[#031A0E] hover:bg-[#2AC57A] disabled:opacity-40">Crear</button>
              </div>
              {error && <p role="alert" className="text-[11.5px] leading-4 text-[#ff7b7b]">{error}</p>}
            </form>
          ) : (
            <button type="button" onClick={onStartCreate}
              className="group grid aspect-square w-full place-items-center rounded-[18px] border border-dashed border-white/15 text-[#A8A8A8] transition-colors hover:border-[#22B16B]/60 hover:bg-[#22B16B]/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-white">
              <span className="flex flex-col items-center gap-2 text-[13.5px] font-semibold">
                <span className="grid size-11 place-items-center rounded-full bg-white/[0.06] transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none"><Plus className="size-5" /></span>
                Nueva lista
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
