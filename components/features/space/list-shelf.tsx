"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import GlassFolder, { MAX_VISIBLE, type FolderFile } from "@/components/ui/glass-folder-cards";
import { ArrowLeft, ArrowRight, Check, NavArrowDown, Plus } from "@/components/ui/icons";
import type { ShelfLayout, ShelfSize, ShelfSort } from "@/hooks/use-shelf-prefs";
import { defaultFolderColor, folderColorRank } from "@/lib/lists/folder-colors";
import type { MovieMedia } from "@/types/catalog";

export type CollectionKind = "continue" | "saved" | "rated" | "custom";

export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly kind: CollectionKind;
  readonly items: readonly MovieMedia[];
}

const COUNT_LABEL: Record<CollectionKind, [string, string]> = {
  continue: ["en curso", "en curso"],
  saved: ["guardada", "guardadas"],
  rated: ["valorada", "valoradas"],
  custom: ["obra", "obras"],
};

const SORTS: readonly { id: ShelfSort; label: string }[] = [
  { id: "manual", label: "Mi orden" },
  { id: "nombre", label: "Nombre (A–Z)" },
  { id: "color", label: "Color" },
  { id: "tamano", label: "Más obras primero" },
];
const SIZES: readonly { id: ShelfSize; label: string }[] = [
  { id: "s", label: "Pequeñas" },
  { id: "m", label: "Medianas" },
  { id: "l", label: "Grandes" },
];
/** Ancho de cada carpeta: en móvil, más estrechas para que quepan dos y media de un vistazo. */
const WIDTHS: Record<"desktop" | "mobile", Record<ShelfSize, number>> = {
  desktop: { s: 184, m: 236, l: 300 },
  mobile: { s: 150, m: 184, l: 236 },
};
/** A partir de cuántas carpetas aparece el índice «Ir a…». */
const JUMP_FROM = 6;

const MOBILE_QUERY = "(max-width: 639px)";
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (notify) => { const mq = window.matchMedia(MOBILE_QUERY); mq.addEventListener("change", notify); return () => mq.removeEventListener("change", notify); },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/** Las obras que asoman de la carpeta: las más recientes delante (la carpeta pone la última al frente). */
function folderFiles(items: readonly MovieMedia[]): FolderFile[] {
  return items.slice(0, MAX_VISIBLE).reverse().map((item) => ({ name: item.title, image: item.imageUrl || undefined }));
}

/** Las carpetas fijas (Seguir viendo, Guardados, Valoradas) van siempre primero; las propias, según la preferencia. */
function sortCollections(collections: readonly Collection[], sort: ShelfSort, order: readonly string[], colorOf: (c: Collection) => string): Collection[] {
  const pinned = collections.filter((c) => c.kind !== "custom");
  const custom = collections.filter((c) => c.kind === "custom");
  if (sort === "nombre") custom.sort((a, b) => a.name.localeCompare(b.name, "es"));
  else if (sort === "color") custom.sort((a, b) => folderColorRank(colorOf(a)) - folderColorRank(colorOf(b)) || a.name.localeCompare(b.name, "es"));
  else if (sort === "tamano") custom.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "es"));
  else {
    // «Mi orden»: las que el usuario colocó van como las colocó; las nuevas, detrás, por orden de creación.
    const rank = new Map(order.map((id, i) => [id, i] as const));
    custom.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }
  return [...pinned, ...custom];
}

const MENU_CONTENT =
  "z-50 min-w-[210px] rounded-[8px] border border-white/10 bg-[#0C1611]/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const MENU_ITEM =
  "flex cursor-pointer items-center justify-between gap-3 rounded-[4px] px-3 py-2.5 text-[14px] text-white outline-none data-[highlighted]:bg-white/[0.08]";
const TOOL_BUTTON =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-white/10 bg-white/[0.05] px-3 text-[13.5px] font-semibold text-[#E0E0E0] transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-white data-[state=open]:bg-white/[0.12]";
const SEGMENT = "inline-flex shrink-0 rounded-[4px] border border-white/10 bg-white/[0.05] p-0.5";

interface Props {
  readonly collections: readonly Collection[];
  readonly selectedId: string;
  /** `centerX` es el centro de la carpeta en la pantalla: de ahí «crece» el contenido que se abre debajo. */
  readonly onSelect: (id: string, centerX: number) => void;
  readonly colors: Readonly<Record<string, string>>;
  readonly order: readonly string[];
  readonly sort: ShelfSort;
  readonly size: ShelfSize;
  readonly layout: ShelfLayout;
  readonly onSortChange: (sort: ShelfSort) => void;
  readonly onSizeChange: (size: ShelfSize) => void;
  readonly onLayoutChange: (layout: ShelfLayout) => void;
  /** Nuevo orden manual de las carpetas propias (ids). */
  readonly onOrderChange: (order: readonly string[]) => void;
  readonly canCreate: boolean;
  readonly onNewFolder: () => void;
}

/**
 * Estantería de colecciones: cada colección (Seguir viendo, Guardados, Valoradas y tus listas) es una carpeta de cristal
 * del color que elijas. Un botón «Organizar» despliega en horizontal sus ajustes: orden (con colocación a mano), tamaño,
 * fila o cuadrícula y un índice para saltar a cualquiera cuando hay muchas. Con la fila larga hay flechas y un indicador.
 */
export function ListShelf({
  collections, selectedId, onSelect, colors, order, sort, size, layout, onSortChange, onSizeChange, onLayoutChange, onOrderChange,
  canCreate, onNewFolder,
}: Props) {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, visible: 1, total: 1 });
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const width = WIDTHS[isMobile ? "mobile" : "desktop"][size];
  const bodyHeight = Math.round((width * 272) / 340);
  const colorOf = useCallback((c: Collection) => colors[c.id] ?? defaultFolderColor(c.id, c.kind), [colors]);
  const ordered = useMemo(() => sortCollections(collections, sort, order, colorOf), [collections, sort, order, colorOf]);
  const isRow = layout === "fila";
  const canArrange = sort === "manual";
  const arranging = isArranging && canArrange;

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setScroll({ left: el.scrollLeft, visible: el.clientWidth, total: el.scrollWidth });
  }, []);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, ordered.length, width, isRow]);

  const canScrollBack = isRow && scroll.left > 4;
  const canScrollOn = isRow && scroll.left + scroll.visible < scroll.total - 4;
  function page(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * scroll.visible * 0.8, behavior: "smooth" });
  }

  const slot = width + 24;
  const firstShown = Math.min(ordered.length, Math.floor(scroll.left / slot) + 1);
  const lastShown = Math.min(ordered.length, Math.floor((scroll.left + scroll.visible - 24) / slot) + 1);

  function pick(id: string, element: Element | null) {
    const rect = element?.getBoundingClientRect();
    onSelect(id, rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
  }
  function jumpTo(id: string) {
    const el = document.getElementById(`carpeta-${id}`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    pick(id, el);
  }

  /** Coloca la carpeta `id` antes de `beforeId` (o al final si es `null`), solo entre las propias. */
  function moveCustom(id: string, beforeId: string | null) {
    const ids = ordered.filter((c) => c.kind === "custom").map((c) => c.id).filter((x) => x !== id);
    const at = beforeId === null ? ids.length : ids.indexOf(beforeId);
    ids.splice(at === -1 ? ids.length : at, 0, id);
    onOrderChange(ids);
  }
  /** Mueve una posición hacia delante (-1) o hacia atrás (+1) dentro de las propias. */
  function nudge(id: string, delta: -1 | 1) {
    const ids = ordered.filter((c) => c.kind === "custom").map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onOrderChange(ids);
  }

  const customIds = ordered.filter((c) => c.kind === "custom").map((c) => c.id);

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      {/* Barra: cuántas hay, «Organizar» (que despliega sus ajustes en horizontal) y «Nueva carpeta». */}
      <div className="flex min-w-0 items-center gap-2">
        <p className="mr-auto shrink-0 text-[13.5px] tabular-nums text-[#8A8A8A]" aria-live="polite">
          {ordered.length} {ordered.length === 1 ? "carpeta" : "carpetas"}
          {isRow && scroll.total > scroll.visible + 8 ? ` · viendo ${firstShown}–${lastShown}` : ""}
        </p>

        <AnimatePresence initial={false}>
          {isOrganizing && (
            <motion.div key="ajustes" id="ajustes-carpetas"
              initial={reduceMotion ? false : { width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={reduceMotion ? undefined : { width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="min-w-0 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none]">
              <div className="flex items-center gap-2 pl-1 pr-1">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger className={`group ${TOOL_BUTTON}`}>
                    <span className="text-[#8A8A8A]">Orden:</span> {SORTS.find((s) => s.id === sort)!.label}
                    <NavArrowDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" sideOffset={6} className={MENU_CONTENT}>
                      <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => onSortChange(v as ShelfSort)}>
                        {SORTS.map((s) => (
                          <DropdownMenu.RadioItem key={s.id} value={s.id} className={MENU_ITEM}>
                            {s.label}
                            <DropdownMenu.ItemIndicator><Check className="size-4 text-[#5FD39A]" /></DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        ))}
                      </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {canArrange && customIds.length > 1 && (
                  <button type="button" aria-pressed={isArranging} onClick={() => setIsArranging((v) => !v)}
                    className={`${TOOL_BUTTON} ${isArranging ? "!border-white/50 !bg-white/15 !text-white" : ""}`}>
                    {isArranging ? "Listo" : "Colocar a mano"}
                  </button>
                )}

                <div role="radiogroup" aria-label="Tamaño de las carpetas" className={SEGMENT}>
                  {SIZES.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={size === s.id} onClick={() => onSizeChange(s.id)} title={s.label}
                      className={`min-h-9 min-w-9 rounded-[3px] px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${size === s.id ? "bg-[#22B16B] text-[#031A0E]" : "text-[#C4C4C4] hover:text-white"}`}>
                      {s.id.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div role="radiogroup" aria-label="Vista" className={SEGMENT}>
                  {([["fila", "Fila"], ["cuadricula", "Cuadrícula"]] as const).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={layout === id} onClick={() => onLayoutChange(id)}
                      className={`min-h-9 rounded-[3px] px-3 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${layout === id ? "bg-white/[0.14] text-white" : "text-[#C4C4C4] hover:text-white"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {ordered.length >= JUMP_FROM && (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger className={`group ${TOOL_BUTTON}`}>
                      Ir a…
                      <NavArrowDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" sideOffset={6} className={`${MENU_CONTENT} max-h-[min(60vh,360px)] overflow-y-auto`}>
                        {ordered.map((c) => (
                          <DropdownMenu.Item key={c.id} onSelect={() => jumpTo(c.id)} className={MENU_ITEM}>
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: colorOf(c) }} />
                              <span className="truncate">{c.name}</span>
                            </span>
                            <span className="shrink-0 text-[12.5px] tabular-nums text-[#8A8A8A]">{c.items.length}</span>
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="button" aria-expanded={isOrganizing} aria-controls="ajustes-carpetas" onClick={() => { setIsOrganizing((v) => !v); setIsArranging(false); }}
          className={`${TOOL_BUTTON} ${isOrganizing ? "!border-white/40 !bg-white/15 !text-white" : ""}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
          </svg>
          Organizar
        </button>
        {canCreate && (
          <button type="button" onClick={onNewFolder}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-[#22B16B] px-3.5 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-white">
            <Plus className="size-4" /> Nueva carpeta
          </button>
        )}
      </div>

      <div className="relative">
        <div ref={scrollerRef} role="group" aria-label="Tus carpetas" onScroll={measure}
          className={`-mx-4 flex gap-6 px-4 pb-3 pt-14 sm:-mx-6 sm:px-6 ${
            isRow ? "snap-x snap-mandatory items-end overflow-x-auto pl-12 [scroll-padding-inline:3rem] [scrollbar-width:none] sm:pl-14" : "flex-wrap items-end gap-y-8"
          }`}>
          {ordered.map((collection, index) => {
            const isSelected = collection.id === selectedId;
            const [one, many] = COUNT_LABEL[collection.kind];
            const count = collection.items.length;
            const customAt = customIds.indexOf(collection.id);
            const isDraggable = arranging && collection.kind === "custom";
            return (
              <div key={collection.id} id={`carpeta-${collection.id}`}
                className={`relative shrink-0 snap-center transition-[opacity,transform] duration-200 ${dragId === collection.id ? "scale-95 opacity-40" : ""}`}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => { setDragId(collection.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", collection.id); } : undefined}
                onDragEnd={() => setDragId(null)}
                onDragOver={arranging && collection.kind === "custom" && dragId ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
                onDrop={arranging && collection.kind === "custom" && dragId ? (e) => { e.preventDefault(); if (dragId !== collection.id) moveCustom(dragId, collection.id); setDragId(null); } : undefined}>
                <div className={arranging && collection.kind !== "custom" ? "pointer-events-none opacity-60" : ""}>
                  <GlassFolder
                    // La carpeta enseña las obras que le pasas; si cambian, la clave la vuelve a montar con la entrada.
                    key={`${collection.id}:${collection.items.slice(0, MAX_VISIBLE).map((i) => i.id).join(",")}`}
                    label={collection.name}
                    meta={`${count} ${count === 1 ? one : many}`}
                    color={colorOf(collection)}
                    width={width}
                    appearDelay={Math.min(index, 8) * 80}
                    files={folderFiles(collection.items)}
                    open={isSelected && !arranging}
                    onOpenChange={(next) => { if (next && !arranging) pick(collection.id, document.getElementById(`carpeta-${collection.id}`)); }}
                  />
                  <span aria-hidden="true" className={`mx-auto mt-1 block h-[3px] rounded-[2px] bg-white transition-[width,opacity] duration-300 ${isSelected ? "w-10 opacity-90" : "w-0 opacity-0"}`} />
                </div>

                {isDraggable && (
                  <div className="absolute inset-x-0 bottom-9 z-30 flex items-center justify-center gap-2" style={{ pointerEvents: "none" }}>
                    <button type="button" aria-label={`Mover ${collection.name} hacia delante`} disabled={customAt <= 0} onClick={() => nudge(collection.id, -1)}
                      style={{ pointerEvents: "auto" }}
                      className="grid size-10 place-items-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-opacity hover:bg-black focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30">
                      <ArrowLeft className="size-5" />
                    </button>
                    <span className="rounded-[4px] bg-black/75 px-2 py-1 text-[11.5px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">Arrastra</span>
                    <button type="button" aria-label={`Mover ${collection.name} hacia atrás`} disabled={customAt === customIds.length - 1} onClick={() => nudge(collection.id, 1)}
                      style={{ pointerEvents: "auto" }}
                      className="grid size-10 place-items-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-opacity hover:bg-black focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30">
                      <ArrowRight className="size-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {canCreate && (
            <div className="shrink-0 snap-center self-end" style={{ width }}>
              <button type="button" onClick={onNewFolder} style={{ height: bodyHeight }}
                className="group grid w-full place-items-center rounded-[8px] border border-dashed border-white/15 text-[#A8A8A8] transition-colors hover:border-[#22B16B]/60 hover:bg-[#22B16B]/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                <span className="flex flex-col items-center gap-2 text-[13.5px] font-semibold">
                  <span className="grid size-11 place-items-center rounded-full bg-white/[0.06] transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none"><Plus className="size-5" /></span>
                  Nueva carpeta
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Flechas para recorrer la fila (en móvil se desliza con el dedo). */}
        {([-1, 1] as const).map((direction) => {
          const visible = direction === -1 ? canScrollBack : canScrollOn;
          return (
            <button key={direction} type="button" tabIndex={visible ? 0 : -1} aria-hidden={!visible}
              aria-label={direction === -1 ? "Carpetas anteriores" : "Más carpetas"} onClick={() => page(direction)}
              className={`absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-[opacity,background-color] hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-white sm:grid ${
                direction === -1 ? "left-1" : "right-1"
              } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {direction === -1 ? <ArrowLeft className="size-5" /> : <ArrowRight className="size-5" />}
            </button>
          );
        })}
      </div>

      {/* Indicador de por dónde vas en una fila larga. */}
      {isRow && scroll.total > scroll.visible + 8 && (
        <div aria-hidden="true" className="-mt-1 h-[3px] rounded-[2px] bg-white/10">
          <div className="h-full rounded-[2px] bg-white/60 transition-[margin,width] duration-150"
            style={{ width: `${(scroll.visible / scroll.total) * 100}%`, marginLeft: `${(scroll.left / scroll.total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
