"use client";

import Link from "next/link";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import type { MediaItem, PosterRatio } from "@/types/catalog";
import styles from "./poster-card.module.css";

type CardSize = "sm" | "md" | "lg";

const WIDTH: Record<CardSize, number> = { sm: 140, md: 180, lg: 340 };

const CARD_CLASS =
  `relative block w-full overflow-hidden rounded-[6px] border border-transparent bg-transparent transition-[transform,border-color,box-shadow] duration-[220ms] active:scale-[0.97] ${styles.card}`;

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
}: PosterCardProps) {
  const wrapStyle = fluid ? undefined : { width: `min(${WIDTH[size]}px, 82vw)`, maxWidth: "100%" };
  const wrapClass = `group/card relative min-w-0 snap-start text-left ${styles.wrap}${fluid ? " w-full" : " shrink-0"}`;

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
      aria-pressed={inList}
      className={`absolute right-1 top-0 z-20 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 transition-opacity duration-200 ${
        inList ? "opacity-100" : styles.listButton
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
      <div className={wrapClass} style={wrapStyle}>
        <Link href={href} className={CARD_CLASS}>{cardContent}</Link>
        {listBtn}
      </div>
    );
  }

  return (
    <div className={wrapClass} style={wrapStyle}>
      <button type="button" onClick={onClick} className={CARD_CLASS}>{cardContent}</button>
      {listBtn}
    </div>
  );
}
