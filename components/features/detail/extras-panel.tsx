"use client";

import { useMemo, useState } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { ExtrasPlayerDialog } from "@/components/features/detail/extras-player-dialog";
import { groupExtraKinds } from "@/lib/extras/extras";
import type { MovieExtra } from "@/types/catalog";

const ALL = "all";

interface ExtrasPanelProps {
  readonly extras: readonly MovieExtra[];
}

const CHIP_BASE =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22B16B]";

export function ExtrasPanel({ extras }: ExtrasPanelProps) {
  const [kind, setKind] = useState<string>(ALL);
  const [playing, setPlaying] = useState<MovieExtra | null>(null);
  const kinds = useMemo(() => groupExtraKinds(extras), [extras]);
  const activeKind = kind === ALL || kinds.some((group) => group.kind === kind) ? kind : ALL;
  const visible = activeKind === ALL ? extras : extras.filter((extra) => extra.kind === activeKind);

  return (
    <section aria-label="Extras" className="flex flex-col gap-6">
      {kinds.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtrar extras por tipo">
          {[{ kind: ALL, label: "Todos", count: extras.length }, ...kinds].map((group) => {
            const active = group.kind === activeKind;
            return (
              <li key={group.kind}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(group.kind)}
                  className={`${CHIP_BASE} ${active ? "border-[#22B16B] bg-[#22B16B]/15 text-white" : "border-white/10 bg-white/5 text-[#EEF1F6] hover:border-white/25 hover:bg-white/10"}`}
                >
                  {group.label}
                  <span className="text-[12px] text-white/60">{group.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((extra) => (
          <li key={extra.id}>
            <button
              type="button"
              onClick={() => setPlaying(extra)}
              aria-label={`Ver ${extra.title}`}
              className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#22B16B]"
            >
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-[#0e1a22] to-[#193859] ring-1 ring-white/10 transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:ring-white/30 motion-reduce:transition-none">
                {extra.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={extra.posterUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
                  <GmaIcon name="play" size={20} />
                </span>
                {extra.durationLabel && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[12px] font-medium tabular-nums text-white">
                    {extra.durationLabel}
                  </span>
                )}
              </span>
              <span className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#22B16B]">{extra.kindLabel}</span>
              <span className="mt-0.5 block text-[16px] font-semibold leading-snug text-white">{extra.title}</span>
              {extra.description && (
                <span className="mt-1 line-clamp-2 block text-[14px] text-white/65">{extra.description}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <ExtrasPlayerDialog extra={playing} onClose={() => setPlaying(null)} />
    </section>
  );
}
