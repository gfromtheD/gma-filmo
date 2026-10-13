"use client";

import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { HoverPreviewCard } from "@/components/ui/hover-preview-card";
import { useHoverPreview } from "@/hooks/use-hover-preview";
import { loadCommunityScore } from "@/hooks/use-community-score";
import type { MediaItem, PosterRatio } from "@/types/catalog";

type CardSize = "sm" | "md" | "lg";

const WIDTH: Record<CardSize, number> = { sm: 140, md: 180, lg: 340 };

const CARD_CLASS =
  "relative block w-full overflow-hidden rounded-[6px] border border-transparent bg-transparent transition-[transform,border-color,box-shadow] duration-[220ms] group-hover/card:-translate-y-[3px] group-hover/card:border-[rgba(34,177,107,0.3)] group-hover/card:shadow-[0_14px_32px_rgba(0,0,0,0.65)] active:scale-[0.97]";

interface PosterCardProps {
  readonly item: MediaItem;
  readonly ratio?: PosterRatio;
  readonly size?: CardSize;
  readonly showProgress?: boolean;
  readonly fluid?: boolean;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly onAddList?: () => void;
  readonly inList?: boolean;
  /** Muestra una vista previa flotante al pasar el ratón (no en táctil). */
  readonly hoverPreview?: boolean;
}

export function PosterCard({
  item,
  ratio = "portrait",
  size = "md",
  showProgress = false,
  fluid = false,
  href,
  onClick,
  onAddList,
  inList = false,
  hoverPreview = false,
}: PosterCardProps) {
  const preview = useHoverPreview<HTMLDivElement>(hoverPreview);
  const detailHref = href ?? (item.kind === "series" ? `/series/${item.id}` : `/cortos/${item.id}`);
  const wrapProps = hoverPreview
    ? {
        ref: preview.anchorRef,
        onPointerEnter: (event: React.PointerEvent) => {
          preview.onPointerEnter(event);
          // Precarga la nota durante la espera de apertura para que el panel nazca con su altura final.
          if (event.pointerType === "mouse") void loadCommunityScore(item.numericId);
        },
        onPointerLeave: preview.onPointerLeave,
      }
    : {};
  const previewNode = preview.anchorBox ? (
    <HoverPreviewCard
      item={item}
      anchorBox={preview.anchorBox}
      detailHref={detailHref}
      onPointerEnter={preview.keepOpen}
      onPointerLeave={preview.scheduleClose}
      onClose={preview.close}
    />
  ) : null;

  const wrapStyle = fluid ? undefined : { width: WIDTH[size] };
  const wrapClass = `group/card relative text-left${fluid ? " w-full" : " shrink-0"}`;

  /* ── inner card content ── */
  const cardContent = (
    <>
      <PosterArt style={item.style} title={item.title} kind={item.kind} genre={item.genre} ratio={ratio} imageUrl={item.imageUrl} />
      {showProgress && item.progress != null && (
        <div
          className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 h-[3px] overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <div className="h-full rounded-full bg-[#22B16B]" style={{ width: `${item.progress * 100}%` }} />
        </div>
      )}
    </>
  );

  /* ── watchlist ribbon — sibling to the card, NOT nested inside it ── */
  const listBtn = onAddList ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAddList(); }}
      aria-label={inList ? "Quitar de Mi Lista" : "Añadir a Mi Lista"}
      className={`absolute right-2.5 top-0 z-20 border-0 bg-transparent p-0 transition-opacity duration-200 ${
        inList ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
      }`}
    >
      {inList ? (
        <GmaIcon
          name="bookmark"
          size={30}
          strokeWidth={0}
          style={{ fill: "#22B16B", stroke: "none", animation: "bookmarkDrop 0.36s cubic-bezier(0.34,1.56,0.64,1) both" }}
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm">
          <GmaIcon name="plus" size={14} />
        </div>
      )}
    </button>
  ) : null;

  if (href) {
    return (
      <div className={wrapClass} style={wrapStyle} {...wrapProps}>
        <Link href={href} className={CARD_CLASS}>{cardContent}</Link>
        {listBtn}
        {previewNode}
      </div>
    );
  }

  return (
    <div className={wrapClass} style={wrapStyle} {...wrapProps}>
      <button type="button" onClick={onClick} className={CARD_CLASS}>{cardContent}</button>
      {listBtn}
      {previewNode}
    </div>
  );
}
