"use client";

import Link from "next/link";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { workPath } from "@/lib/catalog/work-path";
import { EditPencil } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/poster-art";
import type { RatingEntry } from "@/hooks/use-ratings";
import type { MovieMedia } from "@/types/catalog";
import { MAX_SCORE, scoreLabel, starsToScore } from "@/lib/ratings/score-format";

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
}

/**
 * La ficha entera de una valoración se acerca al espectador al pasar el cursor: sube, crece, se inclina hacia donde
 * apuntas, con el mismo muelle que las carpetas. Con «reducir movimiento» solo cambian la sombra y el borde.
 */
function DiaryCard({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  function move(event: ReactPointerEvent<HTMLLIElement>) {
    if (event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--zx", (((event.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--zy", (((event.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  }
  function leave() {
    ref.current?.style.setProperty("--zx", "0");
    ref.current?.style.setProperty("--zy", "0");
  }
  return (
    <li ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ "--zx": 0, "--zy": 0 } as React.CSSProperties}
      className="group/card relative grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-4 rounded-[8px] border border-white/[0.07] bg-white/[0.03] p-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] transition-[transform,box-shadow,background-color,border-color] duration-500 [transition-timing-function:cubic-bezier(.34,1.36,.5,1)] hover:z-20 focus-within:z-20 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-[0_40px_70px_-24px_rgba(0,0,0,0.95)] motion-safe:hover:[transform:perspective(1400px)_translateY(-8px)_scale(1.035)_rotateX(calc(var(--zy)*-2.2deg))_rotateY(calc(var(--zx)*2.6deg))] sm:grid-cols-[auto_auto_1fr_auto_auto] sm:gap-x-7 sm:p-5">
      {children}
    </li>
  );
}

const ACTION = "grid size-11 place-items-center rounded-[4px] border border-white/10 bg-white/[0.04] text-[#C4C4C4] transition-colors focus-visible:outline-2 focus-visible:outline-white";

/**
 * Diario: lo que has valorado, por meses. Cada valoración es una ficha holgada: el día, la portada grande, el título, tus
 * estrellas con la nota y tu reseña. En pantallas pequeñas la ficha pasa a dos filas para que nada quede apretado.
 */
export function DiaryList({ items, entries }: Props) {
  return (
    <div className="flex flex-col gap-10">
      {byMonth(items, entries).map(([month, group]) => (
        <section key={month} aria-label={month}>
          <h3 className="mb-4 flex items-center gap-4 text-[17px] font-semibold text-white first-letter:uppercase">
            {month}
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
            <span className="text-[13.5px] font-medium tabular-nums text-[#8A8A8A]">{group.length} {group.length === 1 ? "valoración" : "valoraciones"}</span>
          </h3>
          <ul className="flex flex-col gap-4">
            {group.map((item) => {
              const entry = entries[item.numericId]!;
              const date = new Date(entry.ratedAt);
              const score = starsToScore(entry.rating);
              return (
                <DiaryCard key={item.id}>
                  <span className="w-16 shrink-0 text-center sm:w-20">
                    <span className="block text-[38px] font-semibold leading-none tabular-nums text-white sm:text-[46px]">{date.getDate()}</span>
                    <span className="mt-1 block text-[13.5px] font-medium uppercase tracking-wide text-[#8A8A8A]">{date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</span>
                  </span>

                  <Link href={workPath(item)} aria-label={item.title}
                    className="relative w-[168px] shrink-0 overflow-hidden rounded-[6px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-white sm:w-[220px]">
                    <PosterArt style={item.style} title="" kind="movie" ratio="landscape" imageUrl={item.imageUrl} />
                  </Link>

                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <Link href={workPath(item)} className="block text-[20px] font-semibold leading-snug text-white no-underline sm:text-[22px]">{item.title}</Link>
                    {entry.review
                      ? <p className="mt-3 line-clamp-4 max-w-[62ch] text-[15.5px] leading-7 text-[#C4C4C4]">«{entry.review}»</p>
                      : <p className="mt-3 text-[14px] text-[#6F6F6F]">Sin reseña</p>}
                  </div>

                  {/* La nota, con presencia y en la escala de GMA (1–10), la misma de la ficha de la obra. */}
                  <div className="col-span-2 flex items-center gap-4 sm:col-span-1 sm:min-w-[170px] sm:flex-col sm:items-end sm:gap-2.5">
                    <span className="flex items-baseline gap-1 leading-none text-white" aria-label={`Nota: ${score} sobre ${MAX_SCORE}`}>
                      <span className="text-[40px] font-bold tabular-nums tracking-tight sm:text-[52px]">{score}</span>
                      <span className="text-[14px] font-medium text-[#8A8A8A] sm:text-[17px]">/ {MAX_SCORE}</span>
                    </span>
                    <span className="flex flex-col gap-1.5 sm:items-end">
                      <span aria-hidden="true" className="flex gap-[3px]">
                        {Array.from({ length: MAX_SCORE }, (_, i) => (
                          <span key={i} className={`h-[7px] w-[11px] rounded-[2px] sm:w-[13px] ${i < score ? "bg-[#22B16B]" : "bg-white/12"}`} />
                        ))}
                      </span>
                      <span className="text-[13.5px] font-medium text-[#A8A8A8]">{scoreLabel(score)}</span>
                    </span>
                  </div>

                  <div className="col-span-2 flex shrink-0 gap-2 sm:col-span-1 sm:flex-col">
                    <Link href={`${workPath(item)}#valoraciones`} aria-label={`Editar valoración de ${item.title}`} title="Editar valoración"
                      className={`${ACTION} hover:bg-white/10 hover:text-white`}><EditPencil className="size-5" /></Link>
                  </div>
                </DiaryCard>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
