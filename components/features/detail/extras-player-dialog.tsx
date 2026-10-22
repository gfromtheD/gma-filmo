"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ExtraVideoPlayer } from "@/components/features/detail/extra-video-player";
import type { MovieExtra } from "@/types/catalog";
import styles from "./extras-player-dialog.module.css";

interface ExtrasPlayerDialogProps {
  readonly extras: readonly MovieExtra[];
  /** Posición del extra abierto; `null` con el diálogo cerrado. */
  readonly index: number | null;
  readonly onIndexChange: (index: number | null) => void;
}

/**
 * Flechas de navegación sin recuadro: solo el trazo, con proporción fija, sombra para leerse sobre
 * cualquier imagen y respuesta al hover, al foco de teclado y a la pulsación.
 *
 * El hueco lateral `--g` depende del ancho de la ventana de forma continua (0 por debajo de 600 px, hasta
 * 104 px en ancha) y el visor lo sigue al instante al arrastrar el borde. Las flechas laterales miden
 * siempre lo mismo y quedan centradas en ese hueco. Cuando el hueco ya no les da sitio (< 760 px, justo
 * antes de tocar el borde de la ventana o el reproductor) se desvanecen y, a continuación, arranca la
 * animación del chip inferior. Ambas tienen duración propia (ver extras-player-dialog.module.css).
 * En pantallas táctiles (móvil) nunca hay flechas laterales: siempre el chip bajo el reproductor.
 */
const ARROW_COMMON =
  "group items-center justify-center rounded-xl transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#22B16B]";

const SIDE_ARROW = `${ARROW_COMMON} ${styles.sideArrow} absolute top-1/2 z-10 flex h-[min(220px,100%)] w-12 -translate-y-1/2 text-white/35`;
const ROW_ARROW = `${ARROW_COMMON} flex h-11 w-14 shrink-0 rounded-full text-white/85 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-25 ${styles.chipItem}`;

function TallChevron({ direction, size, strokeWidth = 4.5 }: { readonly direction: "left" | "right"; readonly size: string; readonly strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 32 96"
      fill="none"
      aria-hidden="true"
      className={`w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out group-active:scale-90 motion-reduce:transition-none ${size}`}
    >
      <path
        d={direction === "left" ? "M26 5 L6 48 L26 91" : "M6 5 L26 48 L6 91"}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SIDE_CHEVRON = "h-[55%] max-h-[120px] shrink-0 group-hover:scale-110";
const ROW_CHEVRON = "h-7";

interface NavArrowProps {
  readonly direction: "left" | "right";
  readonly label: string;
  readonly onClick: () => void;
}

function SideArrow({ direction, label, onClick }: NavArrowProps) {
  // Centrada en el hueco lateral (--g); con --g = 64 px queda a 8 px del vídeo y a 8 px del borde de la ventana.
  const edge = direction === "left" ? "left-[calc((var(--g)_+_48px)_/_-2)]" : "right-[calc((var(--g)_+_48px)_/_-2)]";
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`${SIDE_ARROW} ${edge}`}>
      <TallChevron direction={direction} size={SIDE_CHEVRON} />
    </button>
  );
}

function RowArrow({ direction, label, onClick, disabled }: NavArrowProps & { readonly disabled: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={ROW_ARROW}>
      <TallChevron direction={direction} size={ROW_CHEVRON} strokeWidth={7} />
    </button>
  );
}

/** Visor de extras (vídeo o imagen) con flechas para recorrer el resto sin cerrar. */
export function ExtrasPlayerDialog({ extras, index, onIndexChange }: ExtrasPlayerDialogProps) {
  const extra = index === null ? null : (extras[index] ?? null);
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < extras.length - 1;
  const [infoOpen, setInfoOpen] = useState(false);
  const hasInfo = Boolean(extra?.description);

  // Cada extra se abre con el texto plegado.
  useEffect(() => setInfoOpen(false), [index]);

  const counter = index !== null && extras.length > 1 ? `${index + 1} / ${extras.length}` : null;
  const goPrev = () => onIndexChange(index! - 1);
  const goNext = () => onIndexChange(index! + 1);

  // En una imagen las flechas del teclado pasan al anterior/siguiente (en un vídeo saltan ±10 s).
  useEffect(() => {
    if (!extra || extra.mediaType !== "image" || index === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPrev) onIndexChange(index! - 1);
      if (event.key === "ArrowRight" && hasNext) onIndexChange(index! + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [extra, index, hasPrev, hasNext, onIndexChange]);

  return (
    <Dialog.Root open={extra !== null} onOpenChange={(open) => { if (!open) onIndexChange(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`${styles.content} fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain px-[var(--g)] outline-none [scrollbar-width:thin] [--reserve:210px] [@media(max-height:500px)_and_(min-width:760px)]:[--reserve:104px] [@media(max-height:500px)_and_(max-width:759px)]:[--reserve:172px] [--g:clamp(0px,calc(40vw_-_240px),104px)] w-[min(calc(100vw-32px),calc(1040px+2*var(--g)),calc((100dvh-var(--reserve))*1.7778+2*var(--g)))]`}
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#22B16B]">
                {extra?.kindLabel}
                {index !== null && extras.length > 1 && (
                  <span className="ml-2 font-medium normal-case tracking-normal text-white/50">
                    {index + 1} / {extras.length}
                  </span>
                )}
              </p>
              <Dialog.Title className="truncate text-[18px] font-semibold text-white">{extra?.title}</Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Cerrar extra"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-[#22B16B]"
            >
              <GmaIcon name="close" size={18} />
            </Dialog.Close>
          </div>

          <div className="relative">
            {extra?.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={extra.id}
                src={extra.videoUrl}
                alt={extra.title}
                className="aspect-video w-full rounded-2xl bg-black object-contain"
              />
            ) : (
              extra && (
                <ExtraVideoPlayer
                  key={extra.id}
                  src={extra.videoUrl}
                  managedEndpoint={extra.managedEndpoint}
                  poster={extra.posterUrl ?? undefined}
                  heading={{ kind: extra.kindLabel, title: extra.title, counter }}
                />
              )
            )}

            {hasPrev && <SideArrow direction="left" label="Extra anterior" onClick={goPrev} />}
            {hasNext && <SideArrow direction="right" label="Extra siguiente" onClick={goNext} />}

            {/* Chip bajo el reproductor (ventana estrecha): nace como una esfera y se ensancha; ver el .module.css. */}
            <div className={`${styles.row} flex items-center justify-center`} data-info-open={hasInfo && infoOpen ? "true" : "false"}>
              <div className={`${styles.chip} flex shrink-0 items-center justify-between overflow-hidden rounded-full border border-white/12 bg-white/[0.07] px-1 backdrop-blur-md`}>
                <RowArrow direction="left" label="Extra anterior" onClick={goPrev} disabled={!hasPrev} />
                {index !== null && extras.length > 1 && (
                  <span className={`${styles.chipItem} text-[13px] tabular-nums text-white/70`} aria-hidden="true">
                    {index + 1} / {extras.length}
                  </span>
                )}
                <RowArrow direction="right" label="Extra siguiente" onClick={goNext} disabled={!hasNext} />
              </div>
            </div>
          </div>

          {extra?.description && (
            <>
              {/* Móvil en vertical: el texto va plegado tras «Más info». En escritorio se ve siempre. */}
              <button
                type="button"
                aria-expanded={infoOpen}
                aria-controls="extra-info"
                aria-label={infoOpen ? "Ocultar información" : "Mostrar más información"}
                onClick={() => setInfoOpen((open) => !open)}
                className={`${styles.moreButton} mx-auto mb-1 mt-7 min-h-11 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 text-[13px] font-semibold text-white/70 backdrop-blur-md transition-[color,background-color,border-color] duration-300 hover:border-[#22B16B]/45 hover:bg-[#22B16B]/12 hover:text-[#22B16B] motion-reduce:transition-none [@media(hover:none)_and_(pointer:coarse)]:!mt-1 [@media(hover:none)_and_(pointer:coarse)]:!border-transparent [@media(hover:none)_and_(pointer:coarse)]:!bg-transparent [@media(hover:none)_and_(pointer:coarse)]:!backdrop-blur-none ${infoOpen ? "[@media(hover:none)_and_(pointer:coarse)]:!text-white/55" : "[@media(hover:none)_and_(pointer:coarse)]:!text-[#22B16B]"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B]`}
              >
                <span className={`flex transition-transform duration-300 motion-reduce:transition-none ${infoOpen ? "rotate-45" : ""}`}>
                  <GmaIcon name="plus" size={24} strokeWidth={2.6} />
                </span>
                {infoOpen ? "Menos info" : "Más info"}
              </button>
              <div id="extra-info" className={styles.info} data-open={infoOpen}>
                <div className={styles.infoInner}>
                  <p lang="es" className={`mt-4 w-full whitespace-pre-line break-words text-justify text-[15px] leading-[1.7] text-white/75 hyphens-auto md:text-left md:text-[16px] md:hyphens-none md:[text-wrap:pretty] [@media(max-height:500px)]:hidden`}>
                    {extra.description}
                  </p>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
