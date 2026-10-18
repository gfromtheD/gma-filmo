"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import type { UploadedAsset } from "@/lib/studio/upload-draft";

interface ImageDropProps {
  readonly label: string;
  readonly asset: UploadedAsset | null;
  readonly onFile: (file: File) => void;
  readonly onRemove: () => void;
  /** Clases de tamaño y forma (por ejemplo, `aspect-video`). */
  readonly className?: string;
  /** Qué se pide en esta zona, en una línea (medida sugerida). */
  readonly hint?: string;
  readonly required?: boolean;
  /** Consejo no bloqueante (por ejemplo, la proporción de la imagen). */
  readonly advice?: string | null;
  /** Clases para colocar el consejo (en el banner va a la derecha para no quedar detrás del cartel). */
  readonly adviceClassName?: string;
  /** Cómo se confirma que la imagen ya está subida: un tick en un círculo (por defecto) o la etiqueta «Subido». */
  readonly doneBadge?: "tick" | "chip";
  /** Contenido de relleno cuando aún no hay imagen (una ilustración o un texto). */
  readonly placeholder?: ReactNode;
}

const ACCEPT = "image/jpeg,image/png,image/gif";

/**
 * Zona de imagen de la ficha: se pulsa o se arrastra un archivo encima y la imagen aparece justo donde se verá. Sirve
 * para banner, cartel, retrato y fotogramas; la forma la pone quien la usa.
 */
export function ImageDrop({ label, asset, onFile, onRemove, className = "", hint, required, advice, adviceClassName = "", doneBadge = "tick", placeholder }: ImageDropProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  // El aviso se puede cerrar; vuelve a salir si cambia (otra imagen con otro problema).
  const [dismissedAdvice, setDismissedAdvice] = useState<string | null>(null);
  const status = asset?.status;
  const removeVerb = status === "uploading" ? "Cancelar" : status === "error" ? "Descartar" : "Quitar";
  const showImage = status === "done" && asset?.url;

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
    if (input.current) input.current.value = "";
  }

  return (
    <div data-file-slot={label} className="flex min-w-0 flex-col gap-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsOver(false); pick(e.dataTransfer.files); }}
        className={`relative overflow-hidden rounded-[10px] border transition-colors ${
          isOver ? "border-[#22B16B] bg-[#22B16B]/10"
            : status === "error" ? "border-[#ff5252]/50 bg-[#ff5252]/5"
              : showImage ? "border-white/10 bg-black/40" : "border-dashed border-white/25 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07]"
        } ${className}`}
      >
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url!} alt={`Vista previa: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
        )}

        <input ref={input} id={id} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files)} className="peer sr-only" />
        <label
          htmlFor={id}
          className={`absolute inset-0 z-[1] flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-center peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-white ${
            showImage ? "opacity-0 hover:bg-black/50 hover:opacity-100 focus-visible:opacity-100" : ""
          }`}
        >
          {showImage ? (
            <span className="rounded-full bg-black/70 px-3 py-1 text-[13px] font-bold text-white">Cambiar {label.toLowerCase()}</span>
          ) : (
            <>
              {placeholder}
              <span className="text-[14px] font-bold text-white">
                {label}
                {required ? <span className="ml-1 text-[#22B16B]" aria-hidden="true">*</span> : <span className="ml-1.5 text-[12px] font-medium text-[#7C7C7C]">Opcional</span>}
                {required && <span className="sr-only"> (obligatorio)</span>}
              </span>
              {hint && <span className="text-[12px] leading-4 text-[#A8A8A8]">{hint}</span>}
              <span className="text-[12px] text-[#7C7C7C]">Pulsa o arrastra una imagen</span>
            </>
          )}
        </label>

        {status === "uploading" && (
          <div role="progressbar" aria-label={`Subiendo ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(asset?.progress ?? 0)} className="absolute inset-x-0 bottom-0 z-[2] h-1.5 bg-white/10">
            <div className="h-full bg-[#22B16B] transition-[width]" style={{ width: `${asset?.progress ?? 0}%` }} />
          </div>
        )}
        {status === "done" && (doneBadge === "chip" ? (
          <span className="pointer-events-none absolute left-2 top-2 z-[2] rounded-full bg-[#22B16B] px-2.5 py-0.5 text-[12px] font-bold text-[#031A0E]">Subido</span>
        ) : (
          // Confirmación: un tick en un círculo verde pequeño (el texto «Subido» queda para lectores de pantalla).
          <span className="pointer-events-none absolute left-2 top-2 z-[2] grid size-5 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3"><path d="M5 12.5 10 17.5 19 7" /></svg>
            <span className="sr-only">Subido</span>
          </span>
        ))}
        {asset && (
          <button
            type="button" onClick={onRemove} aria-label={`${removeVerb} ${label}`}
            className="absolute right-2 top-2 z-[2] rounded-full bg-black/70 px-3 py-1 text-[12px] font-bold text-white hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-white"
          >
            {removeVerb}
          </button>
        )}
      </div>
      {status === "error" && <p role="alert" className="text-[13px] text-[#ff7b7b]">{asset?.error ?? "No se pudo subir."}</p>}
      {advice && advice !== dismissedAdvice && (
        <p className={`flex items-start gap-1.5 text-[12.5px] text-[#E8B84B] ${adviceClassName}`}>
          <button
            type="button" onClick={() => setDismissedAdvice(advice)} aria-label="Ocultar este aviso"
            className="mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full text-[#E8B84B]/70 transition-colors hover:text-[#E8B84B] focus-visible:outline-2 focus-visible:outline-white"
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="size-2.5"><path d="M3 3l6 6M9 3 3 9" /></svg>
          </button>
          <span>{advice}</span>
        </p>
      )}
    </div>
  );
}
