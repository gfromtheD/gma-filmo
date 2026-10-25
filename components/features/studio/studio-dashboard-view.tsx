"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { AudiencePanel } from "./studio-audience-panel";
import { StorageCard } from "./studio-storage-card";
import type { Creator, StudioData, StudioTitle, StudioTabId } from "./studio-types";

interface Props {
  data: StudioData;
  onNav: (id: StudioTabId, payload?: StudioTitle) => void;
  onOpenTitle: (t: StudioTitle) => void;
  /** Título que se quiere resaltar (llega desde «Ver estadísticas» en Mis títulos). */
  focusTitle?: StudioTitle | null;
}

/** Superficie de cristal de los paneles: degradado muy tenue y un filo de luz arriba. */
const GLASS =
  "relative overflow-clip rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl";

const PILL_GREEN =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#22B16B] px-4 text-[13.5px] font-bold text-[#031A0E] shadow-[0_8px_24px_-8px_rgba(34,177,107,0.7)] transition-[background-color,transform] hover:bg-[#2AC57A] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function summary(titles: readonly StudioTitle[]): string {
  if (titles.length === 0) return "Todavía no has subido ninguna obra. Empieza por la primera: te guiamos paso a paso.";
  const published = titles.filter((t) => t.status === "publicado").length;
  return `Tienes ${plural(titles.length, "título", "títulos")}, ${published === 0 ? "ninguno publicado aún" : `${published} publicado${published === 1 ? "" : "s"}`}.`;
}

function profileChecklist(creator: Creator) {
  return [
    { label: "Foto o logo", done: Boolean(creator.avatarUrl) },
    { label: "Nombre artístico", done: Boolean(creator.artistName.trim()) },
    { label: "Biografía", done: Boolean(creator.bio.trim()) },
    { label: "Ubicación", done: Boolean(creator.location.trim()) },
    { label: "Redes sociales", done: Object.values(creator.socials).some((v) => v?.trim()) },
  ];
}

/** Ficha de creador: la tarjeta destacada en verde, con el recuento de pasos en grande y la lista con sus checks. */
function ProfilePanel({ creator, onNav, reduceMotion }: { readonly creator: Creator; readonly onNav: Props["onNav"]; readonly reduceMotion: boolean }) {
  const checklist = profileChecklist(creator);
  const done = checklist.filter((c) => c.done).length;
  const isComplete = done === checklist.length;

  return (
    <div className="relative flex h-full flex-col overflow-clip rounded-[22px] bg-[radial-gradient(130%_110%_at_0%_0%,#2AC57A_0%,#168650_38%,#0B3A23_72%,#06170E_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_24px_60px_-30px_rgba(34,177,107,0.6)]">
      <h2 className="text-[17px] font-semibold text-white">{isComplete ? "Tu ficha está completa" : "Completa tu ficha"}</h2>
      <p className="mt-2 flex items-baseline gap-2 text-white">
        <span className="text-[52px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{done}</span>
        <span className="text-[15px] font-medium text-white/70">de {checklist.length} pasos{isComplete ? "" : `, te ${checklist.length - done === 1 ? "queda 1" : `quedan ${checklist.length - done}`}`}</span>
      </p>

      <ul className="mt-4 flex flex-col">
        {checklist.map((c, i) => (
          <motion.li key={c.label}
            initial={reduceMotion ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.25 + i * 0.05 }}>
            <button type="button" onClick={() => onNav("perfil")} disabled={c.done}
              className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-1.5 text-left text-[14px] transition-colors enabled:hover:bg-white/10 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-white">
              <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${c.done ? "border-white bg-white text-[#0B3A23]" : "border-white/40"}`}>
                {c.done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" className="size-3"><path d="M5 12.5 10 17.5 19 7" /></svg>}
              </span>
              <span className={c.done ? "text-white/60 line-through decoration-white/30" : "font-semibold text-white"}>{c.label}</span>
              {!c.done && <span className="ml-auto text-[12.5px] font-semibold text-white/80">Añadir</span>}
              <span className="sr-only">{c.done ? "(hecho)" : "(pendiente)"}</span>
            </button>
          </motion.li>
        ))}
      </ul>

      {/* Separación mínima con la lista; si la tarjeta es más alta, empuja el botón al fondo. */}
      <div aria-hidden="true" className="min-h-6 flex-1" />
      <button type="button" onClick={() => onNav("perfil")}
        className="w-full rounded-full bg-white px-5 py-3 text-[14.5px] font-bold text-[#06170E] transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:max-w-[240px]">
        {isComplete ? "Ver mi ficha" : "Completar ficha"}
      </button>
    </div>
  );
}

/**
 * Panel de Mi Estudio: la audiencia ocupa el bloque grande y a su lado, en una columna, la ficha de creador y el
 * almacenamiento. Los títulos se gestionan en «Mis títulos».
 */
export function DashboardView({ data, onNav }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const { creator, titles } = data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const rise: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14, scale: 0.985 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } } }} className="flex flex-col gap-5">
      <motion.header variants={rise} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight text-white sm:text-[32px]">
            {greeting}{creator.artistName ? `, ${creator.artistName}` : ""}
          </h1>
          <p className="mt-1.5 text-[15px] text-[#A8A8A8]">{summary(titles)}</p>
        </div>
        <button type="button" onClick={() => onNav("subir")} className={`${PILL_GREEN} shrink-0 self-start sm:self-auto`}>Subir una obra</button>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <motion.section variants={rise} aria-label="Tu audiencia" className={`${GLASS} lg:row-span-2`}>
          <AudiencePanel titles={titles} totalViewers={creator.stats.totalViews} trend={data.viewsTrend} />
        </motion.section>

        <motion.section variants={rise} aria-label="Tu ficha de creador" className="lg:col-start-2">
          <ProfilePanel creator={creator} onNav={onNav} reduceMotion={reduceMotion} />
        </motion.section>

        <motion.section variants={rise} aria-label="Almacenamiento" className={`${GLASS} lg:col-start-2`}>
          <StorageCard usedBytes={data.storageUsedBytes} limitBytes={data.storageLimitBytes} freeingBytes={(data.freeing ?? []).reduce((sum, f) => sum + f.sizeBytes, 0)} freeingCount={data.freeing?.length ?? 0} />
        </motion.section>
      </div>
    </motion.div>
  );
}
