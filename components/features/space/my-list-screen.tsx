"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { Plus } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import { useNoticeToast } from "@/components/ui/notice-toast";
import { useLists } from "@/hooks/use-lists";
import { useProgress } from "@/hooks/use-progress";
import { useRatings } from "@/hooks/use-ratings";
import { useWatchlist, watchlistErrorMessage } from "@/hooks/use-watchlist";
import { parseDuration } from "@/lib/utils";
import type { MovieMedia } from "@/types/catalog";
import { ListPanel } from "./list-panel";
import { ListShelf, type Collection } from "./list-shelf";
import { RatingModal } from "./rating-modal";

const SAVED = "guardados";
const RATED = "valoradas";
const PARAM = "lista";

/** Lo que estás viendo a medias, del más reciente al más antiguo. */
function useContinueItems(items: readonly MovieMedia[]) {
  const { entries } = useProgress();
  return useMemo(() => items
    .flatMap((item) => {
      const e = entries[item.numericId];
      if (!e || e.currentTime <= 10 || e.completed) return [];
      const duration = parseDuration(item.runtime);
      const progress = duration > 0 ? Math.min(e.currentTime / duration, 0.94) : 0;
      return progress > 0 ? [{ item, progress, updatedAt: e.updatedAt ?? 0 }] : [];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt), [items, entries]);
}

function ContinueRow({ entries }: { readonly entries: ReturnType<typeof useContinueItems> }) {
  return (
    <section aria-labelledby="seguir-viendo">
      <h2 id="seguir-viendo" className="mb-3 text-[19px] font-semibold text-white">Seguir viendo</h2>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none]">
        {entries.map(({ item, progress }) => (
          <li key={item.id} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
            <Link href={`/ver/${item.id}`} className="group block rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <span className="relative block overflow-hidden rounded-[14px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                <PosterArt style={item.style} title="" kind="movie" ratio="landscape" imageUrl={item.imageUrl} />
                <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="grid size-12 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] shadow-[0_8px_24px_-6px_rgba(34,177,107,0.8)]"><GmaIcon name="play" size={20} /></span>
                </span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15"><span className="block h-full bg-[#22B16B]" style={{ width: `${Math.round(progress * 100)}%` }} /></span>
              </span>
              <span className="mt-2 flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-semibold text-white">{item.title}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-[#5FD39A]">{Math.round(progress * 100)}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Mi lista: lo que dejaste a medias, tus colecciones (Guardados, Valoradas y tus listas) como portadas, y debajo el
 * contenido de la que elijas. La colección elegida va en la URL (?lista=…) para poder enlazarla.
 */
export function MyListScreen({ items }: { readonly items: readonly MovieMedia[] }) {
  const reduceMotion = useReducedMotion();
  const notice = useNoticeToast();
  const { mediaIds, removeMedia } = useWatchlist();
  const { entries: ratingEntries, setRating, getRating, removeRating } = useRatings();
  const { lists, isAvailable, canUse, createList, renameList, deleteList, toggleItem } = useLists();
  const continueEntries = useContinueItems(items);
  const [selectedId, setSelectedId] = useState(SAVED);
  const [isCreating, setIsCreating] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<MovieMedia | null>(null);

  const byId = useMemo(() => new Map(items.map((item) => [item.numericId, item])), [items]);
  const pick = (ids: readonly number[]) => ids.flatMap((id) => byId.get(id) ?? []);

  const collections: Collection[] = [
    { id: SAVED, name: "Guardados", kind: "saved", items: pick([...mediaIds].reverse()) },
    { id: RATED, name: "Valoradas", kind: "rated", items: items.filter((item) => ratingEntries[item.numericId]) },
    ...lists.map((list) => ({ id: list.id, name: list.name, kind: "custom" as const, items: pick(list.itemIds) })),
  ];
  const selected = collections.find((c) => c.id === selectedId) ?? collections[0]!;

  // Colección enlazable: se lee de la URL al entrar y se escribe al cambiar.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl) setSelectedId(fromUrl);
  }, []);
  function select(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id === SAVED) url.searchParams.delete(PARAM); else url.searchParams.set(PARAM, id);
    window.history.replaceState(null, "", url);
  }

  async function handleCreate(name: string): Promise<string | null> {
    const res = await createList(name);
    if (!res.ok) return res.error;
    setIsCreating(false);
    if (res.list) select(res.list.id);
    return null;
  }

  async function handleRemove(item: MovieMedia) {
    if (selected.kind === "saved") {
      if (!(await removeMedia(item.numericId))) notice.showError(watchlistErrorMessage());
      return;
    }
    const res = await toggleItem(selected.id, item.numericId);
    if (!res.ok) notice.showError(res.error);
  }

  async function handleDelete() {
    const id = selected.id;
    select(SAVED);
    const res = await deleteList(id);
    if (!res.ok) notice.showError(res.error);
  }

  const savedCount = collections[0]!.items.length;
  const summary = savedCount === 0 && lists.length === 0
    ? "Guarda cortos para verlos más tarde y ordénalos en tus propias listas."
    : `${savedCount} ${savedCount === 1 ? "obra guardada" : "obras guardadas"}${lists.length ? ` y ${lists.length} ${lists.length === 1 ? "lista tuya" : "listas tuyas"}` : ""}.`;

  const rise: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } } }}
      className="mx-auto flex max-w-[1440px] flex-col gap-9 px-4 pb-24 pt-8 sm:px-6">
      <motion.header variants={rise} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold leading-tight text-white sm:text-[36px]">Mi lista</h1>
          <p className="mt-1.5 text-[15px] text-[#A8A8A8]">{summary}</p>
        </div>
        {canUse && isAvailable && (
          <button type="button" onClick={() => setIsCreating(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-white/10 bg-white/[0.06] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-white">
            <Plus className="size-4" /> Nueva lista
          </button>
        )}
      </motion.header>

      {continueEntries.length > 0 && <motion.div variants={rise}><ContinueRow entries={continueEntries} /></motion.div>}

      <motion.div variants={rise} className="flex flex-col gap-5">
        <ListShelf
          collections={collections} selectedId={selected.id} onSelect={select}
          canCreate={canUse && isAvailable} isCreating={isCreating}
          onStartCreate={() => setIsCreating(true)} onCancelCreate={() => setIsCreating(false)} onCreate={handleCreate}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected.id}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            <ListPanel
              collection={selected} ratingEntries={ratingEntries}
              onRemove={(item) => void handleRemove(item)}
              onRename={async (name) => { const res = await renameList(selected.id, name); return res.ok ? null : res.error; }}
              onDelete={() => void handleDelete()}
              onEditRating={setRatingTarget}
              onRemoveRating={(item) => removeRating(item.numericId)}
              onError={notice.showError}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {ratingTarget && (
        <RatingModal
          item={ratingTarget}
          existing={getRating(ratingTarget.numericId)}
          onSave={(rating, review) => { setRating(ratingTarget.numericId, rating, review); setRatingTarget(null); }}
          onClose={() => setRatingTarget(null)}
        />
      )}
      {notice.toast}
    </motion.div>
  );
}
