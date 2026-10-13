"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useCommunityScore } from "@/hooks/use-community-score";
import { useWatchlist } from "@/hooks/use-watchlist";
import { computePreviewLayout, previewWidth, type PreviewLayout } from "@/lib/hover-preview-layout";
import type { MediaItem } from "@/types/catalog";

interface HoverPreviewCardProps {
  readonly item: MediaItem;
  readonly anchorBox: DOMRect;
  readonly detailHref: string;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly onClose: () => void;
}

const ENTER_MS = 250;

/**
 * Vista previa flotante que "sale" de la portada: imagen, nota, ver / guardar,
 * título, duración, géneros y sinopsis. Se pinta en un portal (no la recorta el
 * scroll horizontal de la fila) con posición fija.
 */
export function HoverPreviewCard({
  item,
  anchorBox,
  detailHref,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: HoverPreviewCardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PreviewLayout | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const { avgScore, voteCount, isLoading } = useCommunityScore(item.numericId);
  const { addMedia, removeMedia, hasMedia } = useWatchlist();
  const inList = hasMedia(item.numericId);

  // 1) medir el alto real del panel y calcular su posición final
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    setLayout(
      computePreviewLayout(
        anchorBox,
        panel.offsetHeight,
        { width: window.innerWidth, height: window.innerHeight },
        headerBottom,
      ),
    );
  }, [anchorBox, item.numericId]);

  // 2) un frame después, pasar del estado "sobre la portada" al estado final
  useEffect(() => {
    if (!layout) return;
    const frame = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  function toggleList() {
    if (inList) removeMedia(item.numericId);
    else addMedia(item.numericId);
  }

  const width = layout?.width ?? previewWidth(anchorBox.width);
  const from = layout?.from;
  const transform = !layout || hasEntered || !from
    ? "none"
    : `translate(${from.dx}px, ${from.dy}px) scale(${from.scale})`;

  const meta =
    item.kind === "movie"
      ? [item.runtime, String(item.year)]
      : [`${item.seasons} temp.`, String(item.year)];
  const genres = item.categories.filter((c) => c !== "Cortometraje").slice(0, 3);

  return createPortal(
    <div
      ref={panelRef}
      role="group"
      aria-label={`Vista previa: ${item.title}`}
      data-hover-preview=""
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="fixed z-[45] cursor-pointer select-none overflow-hidden rounded-[6px] bg-[#181829] text-white shadow-[0_18px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/10 motion-reduce:!transition-none"
      style={{
        left: layout?.left ?? 0,
        top: layout?.top ?? 0,
        width,
        visibility: layout ? "visible" : "hidden",
        opacity: layout && !hasEntered ? 0 : 1,
        transform,
        transformOrigin: "center center",
        transition: hasEntered
          ? `transform ${ENTER_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease-out`
          : "none",
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(24,24,41,0) 55%, #181829 100%)" }}
        />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {(isLoading || avgScore !== null) && (
          <div className="flex min-h-10 items-center gap-3">
            {avgScore !== null && (
              <>
                <span className="inline-flex h-10 min-w-10 items-center justify-center border border-white px-1.5 text-[18px] font-extrabold leading-none">
                  {String(avgScore).replace(".", ",")}
                </span>
                <span className="text-[14px] font-medium leading-tight">{voteCount} votos</span>
              </>
            )}
          </div>
        )}

        <div className="relative z-10 flex gap-2">
          <Link
            href={`/ver/${item.id}`}
            onClick={onClose}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[4px] bg-[#22B16B] px-3 text-[14px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <GmaIcon name="play" size={16} />
            Ver ahora
          </Link>
          <button
            type="button"
            onClick={toggleList}
            aria-pressed={inList}
            aria-label={inList ? "Quitar de mi lista" : "Guardar en mi lista"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <GmaIcon name={inList ? "check" : "bookmark"} size={20} />
          </button>
        </div>

        <Link
          href={detailHref}
          onClick={onClose}
          // Enlace extendido: el ::after cubre todo el panel, así cualquier zona (imagen, texto,
          // metadatos) lleva a la ficha. Los botones llevan z-10 y quedan por encima.
          className="text-[15px] font-bold leading-tight after:absolute after:inset-0 after:content-[''] hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {item.title}
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
          <span>{meta.join(" · ")}</span>
          {(item.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-[3px] bg-white/10 px-1.5 py-0.5 text-[11px] font-bold uppercase">
              {t}
            </span>
          ))}
        </div>

        {genres.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <li key={g} className="rounded-[3px] border border-white/70 px-2 py-0.5 text-[11px] font-extrabold uppercase">
                {g}
              </li>
            ))}
          </ul>
        )}

        {item.synopsis && <p className="line-clamp-5 text-[14px] leading-[1.5] text-[#D9E2EC]">{item.synopsis}</p>}
      </div>
    </div>,
    document.body,
  );
}
