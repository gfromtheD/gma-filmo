"use client";

import type { UploadedAsset } from "@/lib/studio/upload-draft";

export interface ImageFeedbackItem {
  readonly id: string;
  readonly label: string;
  readonly asset: UploadedAsset | null;
  /** Proporción de la zona en la vista previa (por ejemplo, `16 / 9`). */
  readonly aspect: string;
}

/** Aviso común, bien visible, con lo que ha fallado en cada imagen rechazada (no se ha subido nada). */
export function ImageErrors({ items }: { readonly items: readonly ImageFeedbackItem[] }) {
  const failed = items.filter((item) => item.asset?.status === "error");
  if (failed.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-[12px] border border-[#ff5252]/60 bg-[#2a0d0d] px-4 py-3 text-[14px] leading-5 text-[#ffb3b3]">
      {failed.map((item) => (
        <p key={item.id}>
          <strong className="font-bold text-white">{item.label}: no se ha subido.</strong> {item.asset?.error ?? "No se pudo subir."}
        </p>
      ))}
    </div>
  );
}

/** Vista previa de las imágenes ya subidas, cada una con su forma real; no sale hasta que hay alguna. */
export function ImagePreviews({ items }: { readonly items: readonly ImageFeedbackItem[] }) {
  const ready = items.filter((item) => item.asset?.status === "done" && item.asset.url);
  if (ready.length === 0) return null;
  return (
    <section aria-label="Vista previa de las imágenes" className="flex flex-col gap-2 rounded-[14px] border border-white/10 bg-black/30 p-4">
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#A8A8A8]">Vista previa</h3>
      <ul className="flex flex-wrap items-end gap-4">
        {ready.map((item) => (
          <li key={item.id} className={`flex min-w-0 flex-col gap-1.5 ${item.id === "poster" ? "w-[120px]" : "min-w-[240px] flex-1"}`}>
            <div className="overflow-hidden rounded-[8px] border border-white/10 bg-black/50" style={{ aspectRatio: item.aspect }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.asset!.url!} alt={`Vista previa: ${item.label}`} className="h-full w-full object-cover" />
            </div>
            <span className="text-[12px] text-[#A8A8A8]">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
