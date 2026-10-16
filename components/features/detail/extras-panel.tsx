"use client";

import { useState } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ExtrasPlayerDialog } from "@/components/features/detail/extras-player-dialog";
import type { MovieExtra } from "@/types/catalog";

interface ExtrasPanelProps {
  readonly extras: readonly MovieExtra[];
}

export function ExtrasPanel({ extras }: ExtrasPanelProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section aria-label="Extras">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-x-4 gap-y-7">
        {extras.map((extra, index) => (
          <li key={extra.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Ver ${extra.title}`}
              className="group/card block w-full rounded-[8px] text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#22B16B]"
            >
              <span className="relative block aspect-video w-full overflow-hidden rounded-[8px] bg-gradient-to-br from-gma-panel to-[#193859]">
                {extra.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={extra.posterUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.06] motion-reduce:transition-none"
                  />
                )}
                {extra.mediaType === "video" && (
                  <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gma-surface-2 shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-transform duration-200 group-hover/card:scale-110 motion-reduce:transition-none">
                    <GmaIcon name="play" size={28} className="translate-x-[2px]" />
                  </span>
                )}
              </span>
              <span className="mt-2.5 block px-0.5">
                <span className="line-clamp-1 block text-[13px] font-medium leading-snug text-[#EEF1F6] transition-colors duration-200 group-hover/card:text-[#22B16B] motion-reduce:transition-none">
                  {extra.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-[11px] text-[#949494]">
                  <span>{extra.mediaType === "image" ? "Imagen" : "Vídeo"}</span>
                  {extra.durationLabel && (
                    <>
                      <span aria-hidden="true" className="text-white/20">·</span>
                      <span className="tabular-nums">{extra.durationLabel}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ExtrasPlayerDialog extras={extras} index={openIndex} onIndexChange={setOpenIndex} />
    </section>
  );
}
