"use client";

import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { SaveIcon } from "@/components/ui/save-icon";
import { watchlistErrorMessage } from "@/hooks/use-watchlist";
import { HoverPreviewCard } from "@/components/ui/hover-preview-card";
import { CardInfoOverlay } from "@/components/ui/card-info-overlay";
import { useHoverPreview } from "@/hooks/use-hover-preview";
import { loadCommunityScore } from "@/hooks/use-community-score";
import { useNoticeToast } from "@/components/ui/notice-toast";
import type { MediaItem, PosterRatio } from "@/types/catalog";
import styles from "./poster-card.module.css";

type CardSize = "sm" | "md" | "lg";

const WIDTH: Record<CardSize, number> = { sm: 140, md: 180, lg: 340 };

const CARD_CLASS =
  `relative block w-full overflow-hidden rounded-[6px] border border-transparent bg-transparent transition-[transform,border-color,box-shadow] duration-[220ms] active:scale-[0.97] ${styles.card}`;

const CAPTION_LINK_CLASS =
  "block w-full rounded-[8px] text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#22B16B]";

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
  /** Para listados grandes: capa oscura con la descripción al pasar el ratón (sin panel flotante). */
  readonly hoverOverlay?: boolean;
  /** Título y datos (año · categoría) debajo de la imagen, en lugar del título sobre ella. */
  readonly caption?: boolean;
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
  hoverOverlay = false,
  caption = false,
}: PosterCardProps) {
  const preview = useHoverPreview<HTMLDivElement>(hoverPreview);
  const notice = useNoticeToast();
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
      isClosing={preview.isClosing}
      onLoginRequired={notice.showLoginRequired}
      onSaveError={() => notice.showError(watchlistErrorMessage())}
    />
  ) : null;

  const wrapStyle = fluid ? undefined : { width: `min(${WIDTH[size]}px, 82vw)`, maxWidth: "100%" };
  const wrapClass = `group/card relative min-w-0 snap-start text-left ${styles.wrap}${fluid ? " w-full" : " shrink-0"}`;

  /* ── inner card content ── */
  // Con pie de texto la barra va dentro del recuadro de la imagen; si no, se superpondría al año y la categoría.
  const progressBar = showProgress && item.progress != null ? (
    <div
      className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 h-[3px] overflow-hidden rounded-full"
      style={{ background: "rgba(255,255,255,0.18)" }}
    >
      <div className="h-full rounded-full bg-[#22B16B]" style={{ width: `${item.progress * 100}%` }} />
    </div>
  ) : null;

  const cardContent = (
    <>
      {caption ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-[8px]">
          <div className="absolute inset-0 transition-transform duration-300 ease-out group-hover/card:scale-[1.06] motion-reduce:transition-none">
            <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
          </div>
          {progressBar}
        </div>
      ) : (
        <PosterArt style={item.style} title={item.title} kind={item.kind} genre={item.genre} ratio={ratio} imageUrl={item.imageUrl} blurTitleOnHover={hoverOverlay} />
      )}
      {hoverOverlay && <CardInfoOverlay item={item} />}
      {!caption && progressBar}
    </>
  );

  const category = item.categories.find((c) => c !== "Cortometraje");
  const captionNode = caption ? (
    <div className="mt-2.5 px-0.5">
      <h3 className="line-clamp-1 text-[15px] font-medium leading-snug text-[#EEF1F6] transition-colors duration-200 group-hover/card:text-[#22B16B] motion-reduce:transition-none">
        {item.title}
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[14px] text-[#949494]">
        <span className="tabular-nums">{item.year}</span>
        {category && (
          <>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span className="line-clamp-1">{category}</span>
          </>
        )}
      </p>
    </div>
  ) : null;

  /* ── watchlist ribbon — sibling to the card, NOT nested inside it ── */
  const listBtn = onAddList ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAddList(); }}
      aria-label={inList ? "Quitar de Mi Lista" : "Añadir a Mi Lista"}
      aria-pressed={inList}
      className={
        hoverOverlay
          ? "absolute bottom-3 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white opacity-0 transition-opacity duration-[350ms] hover:text-[#22B16B] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white group-hover/card:opacity-100 motion-reduce:transition-none"
          : `absolute right-1 top-0 z-20 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 transition-opacity duration-200 ${
              inList ? "opacity-100" : styles.listButton
            }`
      }
    >
      {hoverOverlay ? (
        <SaveIcon saved={inList ?? false} size={22} />
      ) : inList ? (
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
        <Link href={href} className={caption ? CAPTION_LINK_CLASS : CARD_CLASS}>
          {cardContent}
          {captionNode}
        </Link>
        {listBtn}
        {previewNode}
        {notice.toast}
      </div>
    );
  }

  return (
    <div className={wrapClass} style={wrapStyle} {...wrapProps}>
      <button type="button" onClick={onClick} className={caption ? CAPTION_LINK_CLASS : CARD_CLASS}>
        {cardContent}
        {captionNode}
      </button>
      {listBtn}
      {previewNode}
      {notice.toast}
    </div>
  );
}
