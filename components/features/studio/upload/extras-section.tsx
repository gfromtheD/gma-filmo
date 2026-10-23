"use client";

import { useRef, useState } from "react";
import { CARD_CLASS } from "./fields";
import type { StepProps } from "./step-props";
import { VideoDropzone } from "./video-dropzone";
import { IMAGE_MIME_TYPES, LIMITS } from "@/lib/studio/catalogs";
import { extraSlot, previewSrc, type ExtraItem, type ExtraKind } from "@/lib/studio/upload-draft";

const KIND_LABEL: Record<ExtraKind, string> = { fotograma: "Fotograma", poster: "Póster", video: "Vídeo" };
const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|avi|webm|m4v|mpg|mpeg|mxf|wmv)$/i;

/** Lo que el selector deja elegir: las mismas imágenes que admite el servidor (sin GIF) y cualquier vídeo. */
const ACCEPT = [...IMAGE_MIME_TYPES, "video/*", ".mkv", ".mxf"].join(",");

const isVideoFile =(file: File) => file.type.startsWith("video/") || (file.type === "" && VIDEO_EXTENSIONS.test(file.name));

/** El tipo del extra se deduce del archivo: vídeo, imagen vertical (póster) o imagen apaisada (fotograma). */
async function kindOf(file: File): Promise<ExtraKind> {
  if (isVideoFile(file)) return "video";
  try {
    const bitmap = await createImageBitmap(file);
    const isPortrait = bitmap.height > bitmap.width * 1.1;
    bitmap.close();
    return isPortrait ? "poster" : "fotograma";
  } catch {
    return "fotograma";
  }
}

const THUMB_WIDTH = 320;
/** Si el navegador no saca el fotograma en este tiempo (códec que no lee, archivo enorme…), la casilla sale con el icono. */
const THUMB_TIMEOUT_MS = 2500;

/**
 * Miniatura de un vídeo sacada en el navegador: un fotograma cercano al principio (no el primero, que suele ser negro),
 * reducido a 320 px y en JPEG, para que la casilla del extra se vea como las de imagen. `null` si el navegador no lo lee.
 */
function videoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), THUMB_TIMEOUT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onerror = () => done(null);
    video.onloadedmetadata = () => {
      video.currentTime = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(1, video.duration / 10) : 0;
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, THUMB_WIDTH / (video.videoWidth || THUMB_WIDTH));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round((video.videoWidth || THUMB_WIDTH) * scale);
        canvas.height = Math.round((video.videoHeight || THUMB_WIDTH * 0.5625) * scale);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        done(null);
      }
    };
    video.src = url;
  });
}

/** Los tres extras que se sugieren. Cada uno desaparece al añadir uno de su tipo; después queda solo la casilla «+». */
const SUGGESTIONS = [
  { kind: "fotograma", title: "Fotograma", hint: "Una escena", icon: "frame" },
  { kind: "poster", title: "Póster", hint: "Cartel extra", icon: "poster" },
  { kind: "video", title: "Vídeo", hint: "Entrevista…", icon: "video" },
] as const satisfies readonly { readonly kind: ExtraKind; readonly title: string; readonly hint: string; readonly icon: string }[];

function SlotIcon({ kind }: { readonly kind: "frame" | "poster" | "video" | "more" }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "size-6" } as const;
  if (kind === "poster") return <svg {...common}><rect x="6.5" y="3" width="11" height="18" rx="2" /><path d="m6.5 16 4-4 3 3 2-2 2 2" /></svg>;
  if (kind === "video") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m10.5 9.5 4 2.5-4 2.5v-5Z" /></svg>;
  if (kind === "more") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="10" r="1.5" /><path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 3.5" /></svg>;
}

/**
 * Todas las casillas (fotograma, póster, vídeo, los extras ya subidos y el «+») son iguales entre sí: misma altura y mismo
 * ancho. Cuatro por fila (dos en móvil), repartiéndose todo el ancho de la tarjeta a partes iguales, para que la fila
 * no quede descompensada. Los extras son un complemento: no deben tener más peso que el resto de la ficha.
 */
const TILE_SIZE = "h-[var(--extra-h)] min-w-0";

/** Un extra ya añadido: se ve como una miniatura (o un icono de película si es un vídeo). */
function ExtraTile({ index, extra, onRemove }: { readonly index: number; readonly extra: ExtraItem; readonly onRemove: () => void }) {
  const file = extra.file;
  const status = file?.status;
  const label = `Extra ${index + 1}`;
  const removeVerb = status === "uploading" || status === "processing" ? "Cancelar" : status === "error" ? "Descartar" : "Quitar";
  const preview = extra.kind !== "video" ? previewSrc(file) : null;

  return (
    <li data-file-slot={label} title={file?.name} className={TILE_SIZE}>
      <div className={`relative size-full overflow-hidden rounded-[10px] border bg-white/[0.04] ${status === "error" ? "border-[#ff5252]/50" : "border-white/10"}`}>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Vista previa: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {extra.kind === "video" && status !== "error" && extra.thumb && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={extra.thumb} alt={`Vista previa: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
              <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></svg>
            </span>
          </>
        )}
        {extra.kind === "video" && status !== "error" && !extra.thumb && (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-white/10 to-white/[0.02] p-2 text-center">
            <div className="min-w-0">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-auto size-7 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m10.5 9.5 4 2.5-4 2.5v-5Z" /></svg>
              <p className="mt-1 w-0 min-w-full truncate text-[10.5px] text-[#D0D0D0]">{file?.name}</p>
            </div>
          </div>
        )}
        {status === "error" && <p role="alert" className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] leading-snug text-[#ff7b7b]">{file?.error ?? "No se pudo subir."}</p>}
        {(status === "uploading" || status === "processing") && (
          <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5">
            <p className="text-[10.5px] font-semibold text-white">{status === "processing" ? "Procesando…" : "Subiendo…"}</p>
            <div role="progressbar" aria-label={`Subiendo ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(file?.progress ?? 0)} className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-[#22B16B] transition-[width]" style={{ width: `${file?.progress ?? 0}%` }} />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5">
          <p className="text-[11px] font-bold leading-tight text-white">{KIND_LABEL[extra.kind]}</p>
          {status === "done" && <p className="text-[10.5px] font-bold leading-tight text-[#2AC57A]">Subido</p>}
        </div>
        <button
          type="button" onClick={onRemove} aria-label={`${removeVerb} ${label}`}
          title={removeVerb}
          className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-[15px] font-bold leading-none text-white hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-white"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </li>
  );
}

/** Tráiler (con énfasis: se reproduce en el Home) y extras: una galería visual de fotogramas, pósters y vídeos. */
export function ExtrasSection({ draft, update, files, showErrors }: StepProps) {
  const { extras } = draft;
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const isFull = extras.length >= LIMITS.extras;
  // tres sugerencias a la vista (fotograma, póster y vídeo) hasta que se añade uno de cada tipo; la casilla «+» siempre queda para añadir más
  const pending = isFull ? [] : SUGGESTIONS.filter((suggestion) => !extras.some((e) => e.kind === suggestion.kind));

  async function addFiles(list: FileList | null) {
    const all = Array.from(list ?? []);
    const picked = all.slice(0, LIMITS.extras - extras.length);
    if (input.current) input.current.value = "";
    const left = all.length - picked.length;
    setNotice(left > 0 ? `Caben ${LIMITS.extras} extras por obra: ${left === 1 ? "1 archivo se ha quedado fuera" : `${left} archivos se han quedado fuera`}.` : null);
    if (picked.length === 0) return;
    const kinds = await Promise.all(picked.map(kindOf));
    const thumbs = await Promise.all(picked.map((file, i) => (kinds[i] === "video" ? videoThumbnail(file) : Promise.resolve(null))));
    // Cada extra tiene su hueco propio (`extra:<id>`): varios a la vez se suben en paralelo y quitar uno no toca a los demás.
    const added = kinds.map((kind, i): ExtraItem => ({ id: crypto.randomUUID(), kind, file: null, ...(thumbs[i] ? { thumb: thumbs[i]! } : {}) }));
    update({ extras: [...extras, ...added] });
    added.forEach((extra, i) => files.upload(extraSlot(extra, 0), kinds[i] === "video" ? "video" : "image", picked[i]!));
  }

  const removeExtra = (index: number) => {
    // Los extras sin id (borradores antiguos) se identifican por posición: quitar uno movería a los siguientes, así que las
    // subidas en curso de esos se cancelan. Los que tienen id no se ven afectados.
    const isBusy = (e: ExtraItem) => e.file?.status === "uploading" || e.file?.status === "processing";
    const shifts = (e: ExtraItem, j: number) => !e.id && j > index && isBusy(e);
    files.remove(extraSlot(extras[index]!, index));
    extras.forEach((e, j) => { if (shifts(e, j)) files.remove(extraSlot(e, j)); });
    update({ extras: extras.flatMap((e, j) => (j === index ? [] : [shifts(e, j) ? { ...e, file: null } : e])) });
  };

  return (
    <>
      <div className={`${CARD_CLASS} border-[#22B16B]/40`}>
        <h3 className="text-[19px] font-extrabold text-white">Tráiler</h3>
        <p className="mt-1 mb-4 max-w-[62ch] text-[14px] leading-6 text-[#BBBBBB]">
          Es lo que más ayuda a que alguien se anime a verla: el tráiler se reproducirá en el banner del Home y en tu ficha.
        </p>
        <VideoDropzone slot="trailer" noun="tráiler" file={draft.trailer.file} files={files} showErrors={showErrors} />
      </div>

      <div className={`${CARD_CLASS} flex flex-col gap-4`}>
        <div>
          <h3 className="text-[19px] font-extrabold text-white">Extras <span className="text-[13px] font-medium text-[#7C7C7C]">{extras.length > 0 ? `${extras.length} de ${LIMITS.extras}` : "Opcional"}</span></h3>
          <p className="mt-1 text-[14px] text-[#A8A8A8]">Enseña más de tu obra: fotogramas, pósters o vídeos como entrevistas y making of. Pulsa un hueco o arrastra varios archivos a la vez.</p>
        </div>
        <input
          ref={input} type="file" multiple accept={ACCEPT} data-extras-input
          onChange={(e) => void addFiles(e.target.files)} className="sr-only" tabIndex={-1} aria-hidden="true"
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 [--extra-h:132px] sm:[--extra-h:150px] lg:[--extra-h:170px]">
          {extras.map((extra, i) => <ExtraTile key={extra.id ?? i} index={i} extra={extra} onRemove={() => removeExtra(i)} />)}
          {pending.map((suggestion) => (
            <li key={suggestion.kind} data-extras-suggestion={suggestion.kind} className={TILE_SIZE}>
              <button
                type="button" onClick={() => input.current?.click()} aria-label={`Añadir ${suggestion.title.toLowerCase()}`}
                onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
                  onDragLeave={() => setIsOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsOver(false); void addFiles(e.dataTransfer.files); }}
                className={`group flex size-full flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isOver ? "border-[#22B16B] bg-[#22B16B]/10" : "border-white/30 bg-white/[0.05] hover:border-[#22B16B]/70 hover:bg-[#22B16B]/[0.07]"}`}
              >
                <span className="grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-[#22B16B]/20 group-hover:text-[#2AC57A]">
                  <SlotIcon kind={suggestion.icon} />
                </span>
                <span className="text-[12.5px] font-bold text-white">{suggestion.title}</span>
                <span className="text-[10.5px] leading-[14px] text-[#7C7C7C]">{suggestion.hint}</span>
              </button>
            </li>
          ))}
          {!isFull && (
            <li data-extras-more className={TILE_SIZE}>
              <button
                type="button" onClick={() => input.current?.click()} aria-label="Añadir más extras" title={`Añadir más (hasta ${LIMITS.extras})`}
                onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
                  onDragLeave={() => setIsOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsOver(false); void addFiles(e.dataTransfer.files); }}
                className={`group grid size-full place-items-center rounded-[10px] border border-dashed text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isOver ? "border-[#22B16B] bg-[#22B16B]/10" : "border-white/15 bg-white/[0.025] hover:border-white/35 hover:bg-white/[0.06]"}`}
              >
                <span className="text-white/55 transition-colors group-hover:text-white"><SlotIcon kind="more" /></span>
                <span className="sr-only">Añadir más, hasta {LIMITS.extras}</span>
              </button>
            </li>
          )}
        </ul>
        {notice && <p role="status" className="text-[13px] text-[#E8B84B]">{notice}</p>}
        {showErrors && extras.some((e) => !e.file) && <p role="alert" className="text-[13px] text-[#ff7b7b]">Hay un extra sin archivo: quítalo o súbelo de nuevo.</p>}
      </div>
    </>
  );
}
