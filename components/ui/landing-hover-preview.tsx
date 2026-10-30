"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PosterArt } from "@/components/ui/poster-art";
import { SaveIcon } from "@/components/ui/save-icon";
import { LoadingLabel } from "@/components/ui/loading-label";
import { enterAsGuest } from "@/lib/auth/guest-access";
import { workPath } from "@/lib/catalog/work-path";
import { computePreviewLayout, previewWidth, type PreviewLayout } from "@/lib/hover-preview-layout";
import type { MovieMedia } from "@/types/catalog";

interface LandingHoverPreviewProps {
  readonly item: MovieMedia;
  readonly anchorBox: DOMRect;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly onClose: () => void;
  readonly isClosing?: boolean;
  /** Pulsar el cuerpo de la tarjeta: lleva a la pasarela de inicio de sesión. */
  readonly onRequestLogin: () => void;
  /** Pulsar el icono de guardar: el diálogo de «inicia sesión para guardar» lo abre la fila, que sigue montada. */
  readonly onSaveRequest: () => void;
}

/** Apertura: la tarjeta sube desde la portada y se despliega hacia abajo, igual que en Inicio. */
const ENTER_MS = 280;
const REVEAL_MS = 300;
const FADE_IN_MS = 140;
const BODY_DELAY_MS = 100;
const BODY_MS = 240;
const EXIT_MS = 130;
const PREVIEW_BG = "var(--gma-preview)";
const PREVIEW_BACKGROUND =
  "radial-gradient(120% 70% at 50% 110%, rgba(91,63,209,0.32) 0%, rgba(91,63,209,0) 70%), linear-gradient(180deg, var(--gma-preview) 0%, var(--gma-preview-end) 100%)";
const SHADOW_ROOM = 60;

/**
 * La misma vista previa flotante que en Inicio (sale de la portada, se abre hacia abajo), adaptada a quien todavía
 * no ha entrado: en vez de «Ver ahora» y guardar, ofrece iniciar sesión o entrar directo como invitado.
 */
export function LandingHoverPreview({
  item,
  anchorBox,
  onPointerEnter,
  onPointerLeave,
  onClose,
  isClosing = false,
  onRequestLogin,
  onSaveRequest,
}: LandingHoverPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PreviewLayout | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(false);
  // Sin sesión no se guarda nada: el icono se «marca» un instante (con su saltito) y vuelve a vacío.
  const [flashSaved, setFlashSaved] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setPanelHeight(panel.offsetHeight);
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    setLayout(computePreviewLayout(anchorBox, panel.offsetHeight, { width: window.innerWidth, height: window.innerHeight }, headerBottom));
  }, [anchorBox, item.numericId]);

  useEffect(() => {
    if (!layout) return;
    const frame = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  async function watchAsGuest() {
    setGuestLoading(true);
    setGuestError(false);
    try {
      await enterAsGuest(workPath(item));
    } catch {
      setGuestError(true);
      setGuestLoading(false);
    }
  }

  function requestSave() {
    setFlashSaved(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashSaved(false), 900);
    onSaveRequest();
  }

  function requestLogin() {
    onClose();
    onRequestLogin();
  }

  const width = layout?.width ?? previewWidth(anchorBox.width);
  const from = layout?.from;
  const transform = isClosing
    ? "translateY(-4px) scale(0.985)"
    : !layout || hasEntered || !from
      ? "none"
      : `translate(${from.dx}px, ${from.dy}px) scale(${from.scale})`;

  const imageHeight = Math.round((width * 9) / 16);
  const hiddenBelow = Math.max(0, panelHeight - imageHeight);
  const openClip = `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px -${SHADOW_ROOM}px -${SHADOW_ROOM}px)`;
  const closedClip = `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px ${hiddenBelow}px -${SHADOW_ROOM}px)`;

  const meta = [item.runtime, String(item.year)];
  const genres = item.categories.filter((c) => c !== "Cortometraje").slice(0, 3);

  return createPortal(
    <div
      ref={panelRef}
      role="group"
      aria-label={`Vista previa: ${item.title}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="fixed z-[45] cursor-default select-none overflow-hidden rounded-[6px] text-white shadow-[0_18px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/10 motion-reduce:!transition-none"
      style={{
        left: layout?.left ?? 0,
        top: layout?.top ?? 0,
        width,
        "--preview-image-h": `${imageHeight}px`,
        "--preview-bg": PREVIEW_BG,
        background: PREVIEW_BACKGROUND,
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
      <div className="relative aspect-video w-full overflow-hidden">
        <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--preview-bg) 0%, transparent) 55%, var(--preview-bg) 100%)" }} />
      </div>

      <button type="button" onClick={requestLogin} tabIndex={-1} aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-[var(--preview-image-h)]" />

      <div
        className="flex flex-col gap-3 px-4 pb-4 motion-reduce:!transition-none"
        style={{
          opacity: hasEntered ? 1 : 0,
          transform: hasEntered ? "none" : "translateY(8px)",
          transition: hasEntered
            ? `opacity ${BODY_MS}ms ease-out ${BODY_DELAY_MS}ms, transform ${BODY_MS + 40}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${BODY_DELAY_MS}ms`
            : "none",
        }}
      >
        <div className="relative z-10 flex gap-2">
          <button type="button" onClick={() => void watchAsGuest()} disabled={guestLoading}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-[4px] bg-[#22B16B] px-4 text-[14px] font-bold leading-none text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
            {guestLoading ? <LoadingLabel>Entrando</LoadingLabel> : "Ver como invitado"}
          </button>
          <button type="button" onClick={requestSave} aria-label="Guardar en mi lista"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <SaveIcon saved={flashSaved} size={20} />
          </button>
        </div>
        {guestError && <p role="alert" className="relative z-10 -mt-1 text-[12px] text-red-300">No se pudo entrar. Inténtalo de nuevo.</p>}

        <p className="relative z-10 self-start text-[15px] font-bold leading-tight">{item.title}</p>

        <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
          <span>{meta.join(" · ")}</span>
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
