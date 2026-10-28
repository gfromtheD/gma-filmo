"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PosterArt } from "@/components/ui/poster-art";
import { GmaIcon } from "@/components/ui/gma-icon";
import { SaveIcon } from "@/components/ui/save-icon";
import { useCommunityScore } from "@/hooks/use-community-score";
import { useWatchlist } from "@/hooks/use-watchlist";
import { formatCommunityScore } from "@/lib/ratings/summary";
import { computePreviewLayout, previewWidth, type PreviewLayout } from "@/lib/hover-preview-layout";
import { TrailerVideo } from "@/components/ui/trailer-video";
import { trailerEndpointFor } from "@/lib/media/player-adapter";
import { prefetchPlaybackSource } from "@/hooks/use-media-playback";
import type { MediaItem } from "@/types/catalog";

interface HoverPreviewCardProps {
  readonly item: MediaItem;
  readonly anchorBox: DOMRect;
  readonly detailHref: string;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly onClose: () => void;
  /** El cursor salió: la tarjeta se desvanece antes de desmontarse. */
  readonly isClosing?: boolean;
  /** Invitado: no puede guardar; el aviso lo pinta PosterCard (el panel se cierra al salir el ratón). */
  readonly onLoginRequired: () => void;
  readonly onSaveError: () => void;
}

/** Apertura: la tarjeta sube desde la portada y se despliega hacia abajo (medido en Filmin: 250 ms). */
const ENTER_MS = 280;
const REVEAL_MS = 300;
const FADE_IN_MS = 140;
/** El texto espera un instante a que la tarjeta empiece a abrirse y entonces aparece y sube un poco. */
const BODY_DELAY_MS = 100;
const BODY_MS = 240;
/** Cierre: se desvanece (el hook la desmonta justo después). */
const EXIT_MS = 130;
/** Margen del recorte para no cortar la sombra de la tarjeta una vez abierta. */
const SHADOW_ROOM = 60;
/** Espera con el panel abierto antes de sustituir la portada por el tráiler (el origen ya se pidió al abrir). */
const TRAILER_DELAY_MS = 600;
/** El recuadro mide unos 350 px: 480p se ve bien y su primer trozo llega mucho antes que el de 1080p. */
const TRAILER_MAX_HEIGHT = 480;

/** Tráiler que se funde sobre la portada, sin sonido hasta que se pulse el altavoz; si falla, queda la portada. */
function PanelTrailer({ src, endpoint }: { readonly src?: string; readonly endpoint: string | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  if (hasFailed) return null;

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  return (
    <>
      <TrailerVideo
        src={src}
        endpoint={endpoint}
        videoRef={videoRef}
        maxHeight={TRAILER_MAX_HEIGHT}
        autoPlay
        loop
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => setIsPlaying(true)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        onError={() => setHasFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${isPlaying ? "opacity-100" : "opacity-0"}`}
      />
      {isPlaying && (
        <button type="button" onClick={toggleSound} aria-label={isMuted ? "Activar el sonido del tráiler" : "Silenciar el tráiler"}
          aria-pressed={!isMuted}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <GmaIcon name={isMuted ? "mute" : "volume"} size={15} />
        </button>
      )}
    </>
  );
}

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
  isClosing = false,
  onLoginRequired,
  onSaveError,
}: HoverPreviewCardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PreviewLayout | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerEndpoint = trailerEndpointFor(item);
  const hasTrailer = Boolean(item.trailerUrl || trailerEndpoint);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // El origen del tráiler (y su lista HLS) se pide al abrir la tarjeta: cuando toca reproducirlo ya está aquí.
  useEffect(() => {
    if (trailerEndpoint && !reduceMotion) void prefetchPlaybackSource(trailerEndpoint);
  }, [trailerEndpoint, reduceMotion]);
  const { avgScore, voteCount, isLoading } = useCommunityScore(item.numericId);
  const { addMedia, removeMedia, hasMedia, canSave } = useWatchlist();
  const inList = hasMedia(item.numericId);

  // 1) medir el alto real del panel y calcular su posición final
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setPanelHeight(panel.offsetHeight);
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

  // 3) con tráiler asociado, pasada la espera se reproduce en el mismo recuadro (no con movimiento reducido)
  useEffect(() => {
    if (!hasTrailer || !hasEntered || reduceMotion) return;
    const timer = setTimeout(() => setShowTrailer(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasTrailer, hasEntered, reduceMotion]);

  async function toggleList() {
    if (!canSave) {
      onLoginRequired();
      return;
    }
    const saved = inList ? await removeMedia(item.numericId) : await addMedia(item.numericId);
    if (!saved) onSaveError();
  }

  const width = layout?.width ?? previewWidth(anchorBox.width);
  const from = layout?.from;
  const transform = isClosing
    ? "translateY(-4px) scale(0.985)"
    : !layout || hasEntered || !from
      ? "none"
      : `translate(${from.dx}px, ${from.dy}px) scale(${from.scale})`;

  // Al empezar solo se ve la imagen (justo sobre la portada); el recorte se abre hacia abajo y descubre el resto.
  const imageHeight = Math.round((width * 9) / 16);
  const hiddenBelow = Math.max(0, panelHeight - imageHeight);
  const openClip = `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px -${SHADOW_ROOM}px -${SHADOW_ROOM}px)`;
  const closedClip = `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px ${hiddenBelow}px -${SHADOW_ROOM}px)`;

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
      className="fixed z-[45] cursor-default select-none overflow-hidden rounded-[6px] bg-gma-surface text-white shadow-[0_18px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/10 motion-reduce:!transition-none"
      style={{
        left: layout?.left ?? 0,
        top: layout?.top ?? 0,
        width,
        "--preview-image-h": `${imageHeight}px`,
        visibility: layout ? "visible" : "hidden",
        opacity: isClosing || (layout && !hasEntered) ? 0 : 1,
        transform,
        transformOrigin: "50% 0",
        clipPath: hasEntered && !isClosing ? openClip : closedClip,
        transition: isClosing
          ? `opacity ${EXIT_MS}ms ease-in, transform ${EXIT_MS}ms ease-in`
          : hasEntered
            ? `transform ${ENTER_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${FADE_IN_MS}ms ease-out, clip-path ${REVEAL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : "none",
      } as CSSProperties}
    >
      <div data-preview-image className="relative aspect-video w-full overflow-hidden">
        <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
        {showTrailer && hasTrailer && (
          <PanelTrailer src={item.trailerUrl} endpoint={trailerEndpoint} />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--gma-surface) 0%, transparent) 55%, var(--gma-surface) 100%)" }}
        />
      </div>

      {/* Zona clicable: de donde acaba la imagen hacia abajo. La imagen (y el tráiler que se reproducirá en ella,
          con su botón de sonido) no es clicable. Los botones y el título van por encima (z-10). */}
      <Link
        href={detailHref}
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
        data-preview-hit-area
        className="absolute inset-x-0 bottom-0 top-[var(--preview-image-h)]"
      />

      <div
        data-preview-body
        className="flex flex-col gap-3 px-4 pb-4 motion-reduce:!transition-none"
        style={{
          opacity: hasEntered ? 1 : 0,
          transform: hasEntered ? "none" : "translateY(8px)",
          transition: hasEntered
            ? `opacity ${BODY_MS}ms ease-out ${BODY_DELAY_MS}ms, transform ${BODY_MS + 40}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${BODY_DELAY_MS}ms`
            : "none",
        }}
      >
        {(isLoading || avgScore !== null) && (
          // Mismo formato que en el catálogo: «★ 7.5 · 2 valoraciones». Mientras carga se reserva la línea.
          <div className="flex min-h-5 items-center">
            {avgScore !== null && (
              <p data-preview-score className="text-[13px] font-semibold leading-5 text-white">
                <span className="text-[#22B16B]">★</span> {formatCommunityScore(avgScore)}
                <span className="font-medium text-[#969696]"> · {voteCount} {voteCount === 1 ? "valoración" : "valoraciones"}</span>
              </p>
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
            onClick={() => void toggleList()}
            aria-pressed={inList}
            aria-label={inList ? "Quitar de mi lista" : "Guardar en mi lista"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <SaveIcon saved={inList} size={20} />
          </button>
        </div>

        <Link
          href={detailHref}
          onClick={onClose}
          // Solo el propio texto del título se ilumina en verde al pasar el cursor; el resto de la zona clicable
          // (el enlace de arriba) solo cambia el cursor.
          className="relative z-10 self-start text-[15px] font-bold leading-tight hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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

        {item.synopsis && <p className="line-clamp-5 text-[14px] leading-[1.5] text-[#DDE3DF]">{item.synopsis}</p>}
      </div>
    </div>,
    document.body,
  );
}
