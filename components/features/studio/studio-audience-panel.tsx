"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Check, NavArrowDown } from "@/components/ui/icons";
import { Poster } from "./studio-ui";
import type { StudioTitle, ViewsTrendPoint } from "./studio-types";

type AudienceView = "espectadores" | "valoracion" | "comentarios" | "obras";

/** Lo que un creador quiere saber de su público; cada opción cambia lo que enseña el panel. */
const VIEWS: readonly { id: AudienceView; label: string; hint: string }[] = [
  { id: "espectadores", label: "Espectadores", hint: "Cuántas personas ven tus obras" },
  { id: "obras", label: "Por obra", hint: "Qué obra funciona mejor" },
  { id: "valoracion", label: "Valoración", hint: "Qué nota te ponen" },
  { id: "comentarios", label: "Comentarios", hint: "Qué dicen de tus obras" },
];

const number = (n: number) => n.toLocaleString("es-ES");

/** «2026-10» → «Oct», para el eje del gráfico. */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const m = new Date(year!, month! - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Aviso de «todavía no hay datos», encima del contenido vacío. */
function EmptyNote({ children }: { readonly children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <p className="max-w-[44ch] rounded-full border border-white/10 bg-black/60 px-4 py-2 text-center text-[13px] text-[#C4C4C4] backdrop-blur-md">{children}</p>
    </div>
  );
}

function BigFigure({ value, unit }: { readonly value: string; readonly unit: string }) {
  return (
    <p className="text-[34px] font-semibold tabular-nums tracking-[-0.02em] text-white">
      {value} <span className="text-[15px] font-medium text-[#8A8A8A]">{unit}</span>
    </p>
  );
}

const CHART_W = 600;
const CHART_H = 170;
const CHART_TOP = 20;
const CHART_BASE = 155;

/** Espectadores: personas distintas que han visto alguna obra (cada persona cuenta una vez), y cuántas estuvieron activas cada mes. */
function ViewersView({ totalViewers, trend }: { readonly totalViewers: number | null; readonly trend: readonly ViewsTrendPoint[] }) {
  const max = Math.max(1, ...trend.map((p) => p.v));
  const step = trend.length > 1 ? CHART_W / (trend.length - 1) : 0;
  const points = trend.map((p, i) => `${(i * step).toFixed(1)},${(CHART_BASE - (p.v / max) * (CHART_BASE - CHART_TOP)).toFixed(1)}`);
  const line = points.length > 0 ? `M${points.join(" L")}` : "";
  const area = points.length > 0 ? `${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z` : "";
  return (
    <div className="flex h-full flex-col">
      <BigFigure value={totalViewers === null ? "—" : number(totalViewers)} unit={totalViewers === 1 ? "espectador" : "espectadores"} />
      <p className="mt-1 text-[12.5px] text-[#7C7C7C]">Personas distintas que han visto alguna de tus obras, tú incluido. Cada persona cuenta una vez.</p>
      <div className="relative mt-5 min-h-[170px] flex-1">
        <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 600 170">
          <defs>
            <linearGradient id="aud-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#22B16B" stopOpacity="0.22" />
              <stop offset="1" stopColor="#22B16B" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="600" y1={20 + i * 45} y2={20 + i * 45} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />)}
          {area && <path d={area} fill="url(#aud-fill)" />}
          {line && <path d={line} fill="none" stroke="#22B16B" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {totalViewers === null && <EmptyNote>No se han podido cargar tus espectadores. Recarga la página para reintentarlo</EmptyNote>}
        {totalViewers === 0 && <EmptyNote>Aún no hay espectadores: aparecerán aquí en cuanto alguien vea tus obras</EmptyNote>}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-[#7C7C7C]">{trend.map((p) => <span key={p.m} title={`${number(p.v)} ${p.v === 1 ? "persona activa" : "personas activas"} en el mes`}>{monthLabel(p.m)}</span>)}</div>
    </div>
  );
}

/** Ranking de obras por espectadores: la que más se ve, arriba. */
function TitlesView({ titles }: { readonly titles: readonly StudioTitle[] }) {
  const ranked = [...titles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  const max = Math.max(1, ...ranked.map((t) => t.views ?? 0));
  const hasViews = ranked.some((t) => (t.views ?? 0) > 0);
  if (ranked.length === 0) {
    return <div className="relative h-full min-h-[220px]"><EmptyNote>Cuando subas obras, aquí verás cuál se ve más</EmptyNote></div>;
  }
  return (
    <div className="flex h-full flex-col">
      <BigFigure value={number(titles.length)} unit={titles.length === 1 ? "obra" : "obras"} />
      <p className="mt-1 text-[12.5px] text-[#7C7C7C]">Espectadores distintos de cada obra, de más a menos.</p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {ranked.map((t, i) => (
          <li key={t.id} className="flex items-center gap-3">
            <span className="w-4 text-right text-[13px] font-semibold tabular-nums text-[#7C7C7C]">{i + 1}</span>
            <span className="w-8 shrink-0"><Poster data={t.poster} imageUrl={t.r2PosterUrl} title="" rounded={6} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-semibold text-white">{t.title}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-[#A8A8A8]">{number(t.views ?? 0)}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span className="block h-full rounded-full bg-[#22B16B]" style={{ width: `${((t.views ?? 0) / max) * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      {!hasViews && <p className="mt-4 text-[12.5px] text-[#7C7C7C]">Todavía ninguna tiene visualizaciones.</p>}
    </div>
  );
}

const ALL_TITLES = "__todas__";
const fmtRating = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Valoración: la media general de todas las obras o la de una obra concreta, elegida en su propio desplegable. */
function RatingView({ titles }: { readonly titles: readonly StudioTitle[] }) {
  const [selectedId, setSelectedId] = useState<string>(ALL_TITLES);
  const selected = titles.find((t) => t.id === selectedId) ?? null;
  const pool = selected ? [selected] : titles;
  const rated = pool.filter((t) => t.rating && t.ratingCount);
  const votes = rated.reduce((s, t) => s + (t.ratingCount ?? 0), 0);
  const average = votes ? rated.reduce((s, t) => s + (t.rating ?? 0) * (t.ratingCount ?? 0), 0) / votes : null;
  const options = [
    { id: ALL_TITLES, label: "Media general", hint: "Todas tus obras juntas" },
    ...titles.map((t) => ({ id: t.id, label: t.title, hint: t.ratingCount ? `${fmtRating(t.rating ?? 0)} con ${number(t.ratingCount)} votos` : "Sin votos todavía" })),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <BigFigure value={average ? fmtRating(average) : "Sin votos"} unit={average ? `de 5, con ${number(votes)} votos` : ""} />
        {titles.length > 0 && <OptionPicker small label="Obra" value={selectedId} options={options} onChange={setSelectedId} />}
      </div>

      <div className="relative mt-4 min-h-[170px] flex-1">
        {!selected && rated.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {titles.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)}
                  className="flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left text-[13.5px] transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white">
                  <span className="min-w-0 flex-1 truncate text-white">{t.title}</span>
                  <span className="tabular-nums text-[#A8A8A8]">{t.ratingCount ? `${fmtRating(t.rating ?? 0)} (${number(t.ratingCount)})` : "Sin votos"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ul aria-hidden={rated.length === 0} className="flex flex-col gap-2.5">
              {[5, 4, 3, 2, 1].map((stars) => (
                <li key={stars} className="flex items-center gap-3 text-[12.5px] text-[#7C7C7C]">
                  <span className="w-20">{stars} {stars === 1 ? "estrella" : "estrellas"}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-white/[0.06]" />
                </li>
              ))}
            </ul>
            {rated.length === 0 && (
              <EmptyNote>{selected ? `«${selected.title}» aún no tiene votos` : "Cuando el público vote tus obras, aquí verás tu nota media"}</EmptyNote>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CommentsView({ titles }: { readonly titles: readonly StudioTitle[] }) {
  const total = titles.reduce((s, t) => s + (t.comments ?? 0), 0);
  const withComments = titles.filter((t) => (t.comments ?? 0) > 0).sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0)).slice(0, 5);
  return (
    <div className="flex h-full flex-col">
      <BigFigure value={number(total)} unit={total === 1 ? "comentario" : "comentarios"} />
      <div className="relative mt-4 min-h-[170px] flex-1">
        {withComments.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {withComments.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="truncate text-white">{t.title}</span>
                <span className="shrink-0 tabular-nums text-[#A8A8A8]">{number(t.comments ?? 0)}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyNote>Aún nadie ha comentado: aquí verás qué obras generan conversación</EmptyNote>}
      </div>
    </div>
  );
}

interface PickerOption<T extends string> { readonly id: T; readonly label: string; readonly hint?: string }

/** Desplegable de solo texto con flecha: el de la esquina del panel y el de elegir obra en Valoración. */
function OptionPicker<T extends string>({ value, options, onChange, label, small = false }: {
  readonly value: T; readonly options: readonly PickerOption<T>[]; readonly onChange: (v: T) => void; readonly label: string; readonly small?: boolean;
}) {
  const current = options.find((o) => o.id === value) ?? options[0]!;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${label}: ${current.label}`}
        className={`group inline-flex max-w-full items-center gap-1.5 rounded-[6px] font-semibold text-[#C4C4C4] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[state=open]:text-white ${small ? "min-h-8 text-[13px]" : "min-h-9 text-[14px]"}`}
      >
        <span className="truncate">{current.label}</span>
        <NavArrowDown aria-hidden="true" className="size-4 shrink-0 text-[#A8A8A8] transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8}
          className="z-50 max-h-[320px] min-w-[240px] overflow-y-auto rounded-[16px] border border-white/10 bg-[#0C1611]/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <DropdownMenu.RadioItem key={o.id} value={o.id}
                className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 outline-none transition-colors data-[highlighted]:bg-white/[0.08]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-white">{o.label}</span>
                  {o.hint && <span className="block text-[12px] text-[#8A8A8A]">{o.hint}</span>}
                </span>
                <DropdownMenu.ItemIndicator><Check aria-hidden="true" className="size-4 text-[#5FD39A]" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Audiencia: una sola tarjeta que cambia de contenido con el desplegable (espectadores, por obra, valoración,
 * comentarios). Sin datos reales todavía, cada vista lo dice en lugar de inventar cifras.
 */
export function AudiencePanel({ titles, totalViewers, trend }: {
  readonly titles: readonly StudioTitle[]; readonly totalViewers: number | null; readonly trend: readonly ViewsTrendPoint[];
}) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<AudienceView>("espectadores");

  return (
    <div className="flex h-full min-h-[360px] flex-col p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-white">Tu audiencia</h2>
        <OptionPicker label="Ver" value={view} options={VIEWS} onChange={setView} />
      </div>
      <div className="relative mt-1 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} className="h-full"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
            {view === "espectadores" && <ViewersView totalViewers={totalViewers} trend={trend} />}
            {view === "obras" && <TitlesView titles={titles} />}
            {view === "valoracion" && <RatingView titles={titles} />}
            {view === "comentarios" && <CommentsView titles={titles} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
