"use client";

import { useId, useRef, useState } from "react";
import type { UploadedAsset } from "@/lib/studio/upload-draft";
import { BUTTON_SECONDARY } from "./fields";

interface FileSlotProps {
  readonly label: string;
  readonly required?: boolean;
  /** Reglas del archivo en una línea (formatos y peso). */
  readonly rules: string;
  /** Qué se hace con él o qué medida se sugiere. */
  readonly hint?: string;
  readonly accept: string;
  readonly asset: UploadedAsset | null;
  /** Consejo no bloqueante (por ejemplo, la proporción de una imagen). */
  readonly advice?: string | null;
  readonly previewImage?: boolean;
  readonly onFile: (file: File) => void;
  readonly onRemove: () => void;
  /** Hueco más compacto (listas de subtítulos y extras). */
  readonly compact?: boolean;
}

const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Hueco de archivo: arrastrar y soltar o elegir, con progreso, errores y botón de quitar. */
export function FileSlot({ label, required, rules, hint, accept, asset, advice, previewImage, onFile, onRemove, compact }: FileSlotProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const status = asset?.status;
  // El nombre accesible del botón coincide con lo que se lee en pantalla.
  const removeVerb = status === "uploading" ? "Cancelar" : status === "error" ? "Descartar" : "Quitar";

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
    if (input.current) input.current.value = "";
  }

  return (
    <div
      data-file-slot={label}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsOver(false); pick(e.dataTransfer.files); }}
      className={`flex min-w-0 flex-col gap-2 rounded-[10px] border p-3.5 transition-colors ${
        isOver ? "border-[#22B16B] bg-[#22B16B]/10" : status === "error" ? "border-[#ff5252]/50 bg-[#ff5252]/5" : "border-dashed border-white/20 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-white">
            {label}
            {required ? <span className="ml-1 text-[#22B16B]" aria-hidden="true">*</span> : <span className="ml-2 text-[12px] font-medium text-[#7C7C7C]">Opcional</span>}
            {required && <span className="sr-only"> (obligatorio)</span>}
          </p>
          <p className="text-[12.5px] leading-5 text-[#A8A8A8]">{rules}{hint ? ` · ${hint}` : ""}</p>
        </div>
        {status === "done" && <span className="shrink-0 rounded-full bg-[#22B16B]/15 px-2.5 py-0.5 text-[12px] font-bold text-[#2AC57A]">Subido</span>}
      </div>

      {asset ? (
        <div className="flex items-center gap-3">
          {previewImage && status === "done" && asset.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={`Vista previa: ${label}`} className="h-14 w-14 shrink-0 rounded-[6px] object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-white">{asset.name} <span className="text-[#7C7C7C]">· {fmtBytes(asset.sizeBytes)}</span></p>
            {status === "uploading" && (
              <div role="progressbar" aria-label={`Subiendo ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(asset.progress ?? 0)} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#22B16B] transition-[width]" style={{ width: `${asset.progress ?? 0}%` }} />
              </div>
            )}
            {status === "error" && <p role="alert" className="mt-1 text-[13px] text-[#ff7b7b]">{asset.error ?? "No se pudo subir."}</p>}
            {status === "done" && asset.localOnly && <p className="mt-1 text-[12px] text-[#A8A8A8]">Comprobado. Se enviará cuando se conecte el motor de subida.</p>}
            {advice && <p className="mt-1 text-[12.5px] text-[#E8B84B]">{advice}</p>}
          </div>
          <button type="button" onClick={onRemove} aria-label={`${removeVerb} ${label}`} className={`${BUTTON_SECONDARY} !h-9 shrink-0 !px-3 !text-[13px]`}>
            {removeVerb}
          </button>
        </div>
      ) : (
        <div>
          <input ref={input} id={id} type="file" accept={accept} onChange={(e) => pick(e.target.files)} className="sr-only" />
          <label htmlFor={id} className={`${BUTTON_SECONDARY} cursor-pointer ${compact ? "!h-9 !text-[13px]" : ""}`}>
            Elegir archivo
          </label>
          <span className="ml-3 text-[13px] text-[#7C7C7C]">o arrástralo aquí</span>
        </div>
      )}
    </div>
  );
}
