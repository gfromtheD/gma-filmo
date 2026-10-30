"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNoticeToast } from "@/components/ui/notice-toast";
import { useLists } from "@/hooks/use-lists";
import { useProgress } from "@/hooks/use-progress";
import { useRatings } from "@/hooks/use-ratings";
import { useShelfPrefs } from "@/hooks/use-shelf-prefs";
import { useWatchlist, watchlistErrorMessage } from "@/hooks/use-watchlist";
import { defaultFolderColor } from "@/lib/lists/folder-colors";
import { parseDuration } from "@/lib/utils";
import type { MovieMedia } from "@/types/catalog";
import { ContinueCarousel, type ContinueEntry } from "./continue-carousel";
import { ListPanel } from "./list-panel";
import { ListShelf, type Collection } from "./list-shelf";
import { NewFolderDialog } from "./new-folder-dialog";

const CONTINUE = "seguir";
const SAVED = "guardados";
const RATED = "valoradas";
const PARAM = "lista";

/** Lo que estás viendo a medias, del más reciente al más antiguo. */
function useContinueEntries(items: readonly MovieMedia[]): ContinueEntry[] {
  const { entries } = useProgress();
  return useMemo(() => items
    .flatMap((item) => {
      const e = entries[item.numericId];
      if (!e || e.currentTime <= 10 || e.completed) return [];
      const duration = parseDuration(item.runtime);
      const progress = duration > 0 ? Math.min(e.currentTime / duration, 0.94) : 0;
      return progress > 0 ? [{ item, progress, updatedAt: e.updatedAt ?? 0 }] : [];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ item, progress }) => ({ item, progress })), [items, entries]);
}

/**
 * Mi lista: tus colecciones (Seguir viendo, Guardados, Valoradas y tus listas) como carpetas de cristal, y debajo el contenido de la
 * que abras, que crece desde la propia carpeta. La colección elegida va en la URL (?lista=…) para poder enlazarla.
 */
export function MyListScreen({ items }: { readonly items: readonly MovieMedia[] }) {
  const reduceMotion = useReducedMotion();
  const notice = useNoticeToast();
  const { mediaIds, removeMedia } = useWatchlist();
  const { entries: ratingEntries } = useRatings();
  const { lists, isAvailable, canUse, createList, renameList, deleteList, toggleItem } = useLists();
  const { prefs, setSort, setSize, setLayout, setColor, setOrder } = useShelfPrefs();
  const continueEntries = useContinueEntries(items);
  const panelRef = useRef<HTMLDivElement>(null);
  const [originX, setOriginX] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState(SAVED);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);

  const byId = useMemo(() => new Map(items.map((item) => [item.numericId, item])), [items]);
  const pick = (ids: readonly number[]) => ids.flatMap((id) => byId.get(id) ?? []);

  const collections: Collection[] = [
    // «Seguir viendo» se crea sola en cuanto hay algo a medias; mientras no lo haya, no ocupa sitio.
    ...(continueEntries.length ? [{ id: CONTINUE, name: "Seguir viendo", kind: "continue" as const, items: continueEntries.map((e) => e.item) }] : []),
    { id: SAVED, name: "Guardados", kind: "saved", items: pick([...mediaIds].reverse()) },
    { id: RATED, name: "Valoradas", kind: "rated", items: items.filter((item) => ratingEntries[item.numericId]) },
    ...lists.map((list) => ({ id: list.id, name: list.name, kind: "custom" as const, items: pick(list.itemIds) })),
  ];
  const selected = collections.find((c) => c.id === selectedId) ?? collections.find((c) => c.id === SAVED)!;

  // Colección enlazable: se lee de la URL al entrar y se escribe al cambiar.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl) setSelectedId(fromUrl);
  }, []);
  function select(id: string, centerX?: number) {
    if (centerX !== undefined) setOriginX(centerX);
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id === SAVED) url.searchParams.delete(PARAM); else url.searchParams.set(PARAM, id);
    window.history.replaceState(null, "", url);
  }

  async function handleCreate(name: string, color: string): Promise<string | null> {
    const res = await createList(name);
    if (!res.ok) return res.error;
    setIsNewFolderOpen(false);
    if (res.list) { setColor(res.list.id, color); select(res.list.id); }
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

  const savedCount = collections.find((c) => c.id === SAVED)!.items.length;
  const summary = savedCount === 0 && lists.length === 0
    ? "Guarda cortos para verlos más tarde y ordénalos en tus propias listas."
    : `${savedCount} ${savedCount === 1 ? "obra guardada" : "obras guardadas"}${lists.length ? ` y ${lists.length} ${lists.length === 1 ? "lista tuya" : "listas tuyas"}` : ""}.`;

  const rise: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } } }}
      className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-9 px-4 pb-24 pt-8 sm:px-6">
      <motion.header variants={rise} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold leading-tight text-white sm:text-[36px]">Mi lista</h1>
          <p className="mt-1.5 text-[15px] text-[#A8A8A8]">{summary}</p>
        </div>
      </motion.header>

      <motion.div variants={rise} className="flex flex-col gap-5">
        <ListShelf
          collections={collections} selectedId={selected.id} onSelect={select}
          colors={prefs.colors} order={prefs.order} sort={prefs.sort} size={prefs.size} layout={prefs.layout}
          onSortChange={setSort} onSizeChange={setSize} onLayoutChange={setLayout} onOrderChange={setOrder}
          canCreate={canUse && isAvailable} onNewFolder={() => setIsNewFolderOpen(true)}
        />
        <div ref={panelRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={selected.id}
              style={{ transformOrigin: originX === null || !panelRef.current ? "50% 0" : `${Math.max(0, originX - panelRef.current.getBoundingClientRect().left)}px 0` }}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: -22 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: -8 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}>
              {selected.kind === "continue" ? (
                <ContinueCarousel entries={continueEntries} color={prefs.colors[selected.id] ?? defaultFolderColor(selected.id, selected.kind)} onColor={(hex) => setColor(selected.id, hex)} />
              ) : (
                <ListPanel
                  collection={selected} ratingEntries={ratingEntries}
                  color={prefs.colors[selected.id] ?? defaultFolderColor(selected.id, selected.kind)}
                  onColor={(hex) => setColor(selected.id, hex)}
                  onRemove={(item) => void handleRemove(item)}
                  onRename={async (name) => { const res = await renameList(selected.id, name); return res.ok ? null : res.error; }}
                  onDelete={() => void handleDelete()}
                  onError={notice.showError}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <NewFolderDialog open={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} existingNames={lists.map((l) => l.name)} onCreate={handleCreate} />

      {notice.toast}
    </motion.div>
  );
}
