"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, useRef, type ReactNode } from "react";
import { Segmented } from "@/components/ui/segmented";
import { GALLERY_IMAGES } from "@/lib/profiles/gallery";
import { resizeToAvatarDataUrl } from "@/lib/profiles/image-resize";
import { readableOn } from "@/lib/profiles/color-contrast";
import {
  ICON_IDS, ICON_LABELS, COLOR_IDS, COLOR_VALUES,
  renderAvatar, type AvatarColor,
} from "@/lib/data/profile-avatars";

/** Hojas pequeñas del editor de perfil: cada una cambia una sola cosa (foto o color) y se cierra con «Listo». El nombre se edita en el propio editor. */

const COLOR_LABELS: Record<AvatarColor, string> = {
  green: "Verde", red: "Rojo", orange: "Naranja", yellow: "Amarillo", blue: "Azul",
  navy: "Azul marino", purple: "Morado", pink: "Rosa", teal: "Turquesa", cyan: "Cian",
  lime: "Lima", brown: "Marrón", gold: "Dorado", crimson: "Carmesí", violet: "Violeta",
  rose: "Rosa palo", wine: "Burdeos", peach: "Melocotón", sand: "Arena", mint: "Menta",
  forest: "Verde bosque", olive: "Oliva", sky: "Celeste", petrol: "Petróleo", indigo: "Índigo",
  fuchsia: "Fucsia", lavender: "Lavanda", copper: "Cobre", slate: "Pizarra", silver: "Plata",
};

/** Fotos e iconos son avatares: se muestran redondos, como se verán, y lo bastante grandes para distinguirlos. */
const AVATAR_GRID = "grid grid-cols-3 gap-3.5";
const AVATAR_TILE = "relative aspect-square overflow-hidden rounded-full transition-[transform,box-shadow] duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none";

/** Dónde aparece la hoja: a la derecha del editor (escritorio) o subiendo desde abajo (móvil). */
export type SheetPlacement = "side" | "bottom";

/** Ancho de la hoja lateral y hueco con el editor: el editor usa estas medidas para centrar el conjunto. */
export const SIDE_SHEET_WIDTH = 420;
export const SIDE_SHEET_GAP = 16;

interface SheetProps {
  readonly title: string;
  readonly onDone: () => void;
  readonly children: ReactNode;
  readonly placement: SheetPlacement;
}

function DoneButton({ onDone }: { onDone: () => void }) {
  return (
    <button type="button" onClick={onDone} autoFocus
      className="min-h-10 rounded-full px-3 text-[14px] font-bold text-[#5FD39A] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
      Listo
    </button>
  );
}

/**
 * Hoja de una sola tarea. En escritorio sale hacia la derecha desde detrás del editor, como un panel que se
 * desliza; en móvil, que es vertical, sube desde abajo sobre un velo que deja ver el avatar (para ver el cambio en vivo).
 */
export function Sheet({ title, onDone, children, placement }: SheetProps) {
  const reduceMotion = useReducedMotion();
  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 38 };

  if (placement === "side") {
    const hidden = -(SIDE_SHEET_WIDTH + SIDE_SHEET_GAP + 24); // del todo detrás del editor
    return (
      <motion.div role="dialog" aria-label={title}
        className="absolute top-0 z-0 flex h-full flex-col rounded-[28px] bg-[#141A17] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        style={{ left: `calc(100% + ${SIDE_SHEET_GAP}px)`, width: SIDE_SHEET_WIDTH }}
        initial={{ x: hidden, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: hidden, opacity: 0 }} transition={spring}>
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-4">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          <DoneButton onDone={onDone} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onDone}
        className="absolute inset-0 z-10 bg-black/45"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} />
      <motion.div role="dialog" aria-label={title}
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[max(50%,240px)] flex-col rounded-t-[26px] bg-[#141A17] shadow-[0_-24px_60px_-10px_rgba(0,0,0,0.7)]"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring}>
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-2">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          <DoneButton onDone={onDone} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </motion.div>
    </>
  );
}

// ─── Foto o icono ─────────────────────────────────────────────────────────────

const SOURCES = [{ id: "fotos", label: "Fotos" }, { id: "iconos", label: "Iconos" }] as const;
type Source = (typeof SOURCES)[number]["id"];

export function PhotoSheet({ color, iconId, imageUrl, onPickImage, onPickIcon, onDone, placement }: {
  readonly placement: SheetPlacement;
  readonly color: string;
  readonly iconId: string;
  readonly imageUrl: string;
  readonly onPickImage: (url: string) => void;
  readonly onPickIcon: (id: string) => void;
  readonly onDone: () => void;
}) {
  const [source, setSource] = useState<Source>(iconId ? "iconos" : "fotos");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Elige un archivo de imagen."); return; }
    setUploading(true);
    try {
      // Se reduce a tamaño de avatar (256 px): así se guarda ligero y se ve igual para todos.
      onPickImage(await resizeToAvatarDataUrl(file));
    } catch {
      setError("No se pudo usar esa imagen. Prueba con otra.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet title="Foto de perfil" onDone={onDone} placement={placement}>
      <Segmented label="Origen del avatar" value={source} options={SOURCES} onChange={setSource} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className={`${AVATAR_GRID} mt-4`}>
        {source === "fotos" ? (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Subir una foto mía"
              className={`${AVATAR_TILE} grid place-items-center border-2 border-dashed border-white/25 text-[#C4C4C4] hover:border-[#22B16B]/70 hover:text-white disabled:opacity-60`}>
              <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                {uploading ? "…" : "Subir"}
              </span>
            </button>
            {GALLERY_IMAGES.map((img, index) => {
              const isSelected = imageUrl === img.url;
              return (
                <button key={img.key} type="button" onClick={() => onPickImage(img.url)} aria-pressed={isSelected} aria-label={`Foto ${index + 1}`}
                  className={AVATAR_TILE} style={{ boxShadow: isSelected ? "0 0 0 3px #0F1311, 0 0 0 5.5px #22B16B" : "0 0 0 1px rgba(255,255,255,0.12)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                  {isSelected && (
                    <span className="absolute inset-0 grid place-items-center bg-black/35">
                      <span className="grid size-7 place-items-center rounded-full bg-[#22B16B]">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#031A0E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          ICON_IDS.map((id) => {
            const isSelected = id === iconId;
            return (
              <button key={id} type="button" onClick={() => onPickIcon(id)} aria-pressed={isSelected} aria-label={ICON_LABELS[id]}
                className={`${AVATAR_TILE} bg-black/40`}
                style={{ boxShadow: isSelected ? `0 0 0 3px #0F1311, 0 0 0 5.5px ${color}` : "0 0 0 1px rgba(255,255,255,0.12)", opacity: isSelected ? 1 : 0.8 }}>
                {renderAvatar(id, color, undefined, true)}
              </button>
            );
          })
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-[#ff7b7b]">{error}</p>}
    </Sheet>
  );
}

// ─── Color de acento ──────────────────────────────────────────────────────────

export function ColorSheet({ color, onPick, onDone, placement }: {
  readonly placement: SheetPlacement;
  readonly color: string;
  readonly onPick: (hex: string) => void;
  readonly onDone: () => void;
}) {
  return (
    <Sheet title="Color de acento" onDone={onDone} placement={placement}>
      <div role="radiogroup" aria-label="Color de acento" className="grid grid-cols-5 gap-3">
        {COLOR_IDS.map((id) => {
          const hex = COLOR_VALUES[id as AvatarColor];
          const isSelected = color === hex;
          return (
            <button key={id} type="button" role="radio" aria-checked={isSelected} aria-label={COLOR_LABELS[id as AvatarColor]} title={COLOR_LABELS[id as AvatarColor]}
              onClick={() => onPick(hex)}
              className="relative mx-auto aspect-square w-full max-w-[52px] rounded-full transition-[transform,box-shadow] duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
              style={{ background: hex, boxShadow: isSelected ? `0 0 0 3px #141A17, 0 0 0 5px ${hex}` : "inset 0 0 0 1px rgba(255,255,255,0.14)" }}>
              {isSelected && (
                <svg className="absolute inset-0 m-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={readableOn(hex, "#06170E", "#FFFFFF")} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
