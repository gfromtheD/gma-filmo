"use client";

import Link from "next/link";
import { workPath } from "@/lib/catalog/work-path";
import { EditPencil, Trash } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import type { RatingEntry } from "@/hooks/use-ratings";
import type { MovieMedia } from "@/types/catalog";
import { StarRating } from "./rating-modal";

/** Agrupa por mes de valoración, del más reciente al más antiguo. */
function byMonth(items: readonly MovieMedia[], entries: Record<number, RatingEntry>): [string, MovieMedia[]][] {
  const sorted = [...items].sort((a, b) => (entries[b.numericId]?.ratedAt ?? 0) - (entries[a.numericId]?.ratedAt ?? 0));
  const groups = new Map<string, MovieMedia[]>();
  for (const item of sorted) {
    const month = new Date(entries[item.numericId]?.ratedAt ?? 0).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    groups.set(month, [...(groups.get(month) ?? []), item]);
  }
  return [...groups.entries()];
}

interface Props {
  readonly items: readonly MovieMedia[];
  readonly entries: Record<number, RatingEntry>;
  readonly onEdit: (item: MovieMedia) => void;
  readonly onRemove: (item: MovieMedia) => void;
}

/** Diario: lo que has valorado, por meses, con tu nota y tu reseña. */
export function DiaryList({ items, entries, onEdit, onRemove }: Props) {
  return (
    <div className="flex flex-col gap-7">
      {byMonth(items, entries).map(([month, group]) => (
        <section key={month} aria-label={month}>
          <h3 className="mb-2 text-[13px] font-semibold capitalize text-[#8A8A8A]">{month}</h3>
          <ul className="flex flex-col">
            {group.map((item) => {
              const entry = entries[item.numericId]!;
              const date = new Date(entry.ratedAt);
              return (
                <li key={item.id} className="group flex items-center gap-4 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                  <span className="w-12 shrink-0 text-center">
                    <span className="block text-[20px] font-semibold leading-none tabular-nums text-white">{date.getDate()}</span>
                    <span className="block text-[11.5px] text-[#7C7C7C]">{date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</span>
                  </span>
                  <Link href={workPath(item)} className="w-11 shrink-0 overflow-hidden rounded-[6px]">
                    <PosterArt style={item.style} title="" kind="movie" ratio="portrait" imageUrl={item.imageUrl} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={workPath(item)} className="block truncate text-[15px] font-semibold text-white hover:underline">{item.title}</Link>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating value={entry.rating} readOnly size={14} gap={2} />
                      <span className="text-[12.5px] tabular-nums text-[#8A8A8A]">{entry.rating.toLocaleString("es-ES", { minimumFractionDigits: 1 })}</span>
                    </div>
                    {entry.review && <p className="mt-1 line-clamp-1 text-[13px] italic text-[#8A8A8A]">«{entry.review}»</p>}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <button type="button" onClick={() => onEdit(item)} aria-label={`Editar valoración de ${item.title}`}
                      className="grid size-10 place-items-center rounded-full text-[#A8A8A8] transition-colors hover:bg-white/10 hover:text-white"><EditPencil className="size-4" /></button>
                    <button type="button" onClick={() => onRemove(item)} aria-label={`Borrar valoración de ${item.title}`}
                      className="grid size-10 place-items-center rounded-full text-[#A8A8A8] transition-colors hover:bg-[#ff5252]/10 hover:text-[#ff7b7b]"><Trash className="size-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
