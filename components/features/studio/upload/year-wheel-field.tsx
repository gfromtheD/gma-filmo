"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FieldShell } from "./fields";
import { LIMITS } from "@/lib/studio/catalogs";

/**
 * Altura de cada fila y cuántas se ven a la vez. Solo se ve el valor elegido, centrado en la banda verde: la rueda gira
 * igual (ratón, dedo, teclado) y sus valores entran y salen con la misma animación, pero no se ven los vecinos.
 */
/** Alta de sobra para el texto: deja respiro por arriba y por abajo del valor dentro de la banda. */
const ITEM_H = 58;
/** Banda verde del valor elegido: más baja que la fila, centrada, para que el texto quede justo dentro. */
const BAND_H = 36;
const VISIBLE_BELOW = 0;
const VISIBLE = 1 + VISIBLE_BELOW;
const PAD_BOTTOM = VISIBLE_BELOW * ITEM_H;
const SETTLE_MS = 110;
const TYPE_RESET_MS = 900;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** «Confirmar» sin color: se ilumina en verde solo al pasar el cursor o al enfocarlo con el teclado. */
const CONFIRM_IDLE =
  "inline-flex h-11 items-center justify-center rounded-[4px] border border-white/20 bg-transparent px-5 text-[14px] font-extrabold uppercase text-white transition-colors hover:border-[#22B16B] hover:bg-[#22B16B] hover:text-[#031A0E] focus-visible:border-[#22B16B] focus-visible:bg-[#22B16B] focus-visible:text-[#031A0E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
/** Ya confirmado: el mismo botón queda iluminado en verde (sin tick ni «Confirmado»). */
const CONFIRM_DONE =
  "inline-flex h-11 cursor-default items-center justify-center rounded-[4px] border border-[#22B16B] bg-[#22B16B] px-5 text-[14px] font-extrabold uppercase text-[#031A0E]";
/** «Selecciona»: aviso apagado mientras no se ha tocado la rueda. */
const SELECT_HINT =
  "inline-flex h-11 cursor-default items-center justify-center rounded-[4px] border border-dashed border-white/15 bg-transparent px-5 text-[14px] font-bold text-[#8A8A8A]";

/**
 * Años de la rueda, del año actual hacia atrás (el primero es el actual y se baja hacia los antiguos, igual que la
 * duración y los países). Empiezan en el año actual:
 * en GMA solo se suben obras ya terminadas, no estrenos futuros.
 */
function useYears(): readonly number[] {
  return useMemo(() => {
    const last = new Date().getFullYear();
    return Array.from({ length: last - LIMITS.firstYear + 1 }, (_, i) => last - i);
  }, []);
}


interface WheelProps {
  readonly id: string;
  /** Nombre accesible de la rueda (un `div` no se nombra con `<label for>`). */
  readonly label: string;
  readonly years: readonly number[];
  /** Valor en el que se coloca la rueda al empezar. */
  readonly initial: number;
  /** Valor que está en el centro cada vez que la rueda se para. */
  readonly onSettle: (year: number) => void;
  readonly onEnter: () => void;
  /** Avisa de que la persona ha empezado a usar la rueda (girar, tocar, teclado). */
  readonly onInteract?: () => void;
  /** Texto que se muestra y se lee para cada valor (por ejemplo «12 min» o el nombre de un país). */
  readonly valueText?: (value: number) => string;
  /** Clases del texto de cada fila (los nombres de país necesitan una letra más pequeña que los números). */
  readonly itemClassName?: string;
}

/**
 * La rueda: una lista con imán (scroll-snap) cuyos años se inclinan y se apagan según su distancia al centro. Los
 * efectos se aplican directamente al DOM en cada fotograma de scroll (sin re-renderizar 130 años) y el año del centro
 * se anuncia cuando la rueda se para.
 */
function Wheel({ id, label, years, initial, onSettle, onEnter, onInteract, valueText = String, itemClassName = "text-[21px] font-bold tabular-nums" }: WheelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const settleTimer = useRef<number | null>(null);
  const typed = useRef({ text: "", timer: 0 });
  const frame = useRef(0);
  const [active, setActive] = useState(() => Math.max(0, years.indexOf(initial)));

  const indexNow = () => clamp(Math.round((scroller.current?.scrollTop ?? 0) / ITEM_H), 0, years.length - 1);

  const paint = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const position = el.scrollTop / ITEM_H;
    const from = Math.max(0, Math.floor(position) - 4);
    const to = Math.min(years.length - 1, Math.ceil(position) + 4);
    for (let i = from; i <= to; i += 1) {
      const node = items.current[i];
      if (!node) continue;
      const d = i - position;
      const abs = Math.abs(d);
      node.style.transform = `perspective(360px) rotateX(${clamp(-d * 32, -78, 78)}deg) scale(${(1 - abs * 0.07).toFixed(3)})`;
      node.style.opacity = String(clamp(1 - abs * 0.3, 0.12, 1));
    }
  }, [years.length]);

  const goTo = useCallback((index: number, smooth: boolean) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.current?.scrollTo({ top: clamp(index, 0, years.length - 1) * ITEM_H, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, [years.length]);

  // La rueda empieza colocada en el año de partida.
  useEffect(() => {
    goTo(active, false);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    window.clearTimeout(typed.current.timer);
    cancelAnimationFrame(frame.current);
  }, []);

  function handleScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const index = indexNow();
      setActive(index);
      onSettle(years[index]!);
    }, SETTLE_MS);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = indexNow();
    const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
    if (event.key in steps) { event.preventDefault(); goTo(index + steps[event.key]!, true); return; }
    if (event.key === "Home") { event.preventDefault(); goTo(0, true); return; }
    if (event.key === "End") { event.preventDefault(); goTo(years.length - 1, true); return; }
    if (event.key === "Enter") { event.preventDefault(); onEnter(); return; }
    // Buscar escribiendo: números (años, minutos) o letras (países), sobre el texto que se ve en cada fila.
    if (/^[\p{L}\d ]$/u.test(event.key)) {
      event.preventDefault();
      window.clearTimeout(typed.current.timer);
      typed.current.text = `${typed.current.text}${event.key.toLocaleLowerCase("es")}`.slice(-12);
      typed.current.timer = window.setTimeout(() => { typed.current.text = ""; }, TYPE_RESET_MS);
      const plain = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const wanted = plain(typed.current.text);
      const match = years.findIndex((y) => plain(valueText(y)).startsWith(wanted));
      if (match >= 0) goTo(match, true);
    }
  }

  return (
    <div className="relative w-full shrink-0" style={{ height: VISIBLE * ITEM_H }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 z-0 rounded-[10px] border-y border-[#22B16B]/50 bg-[#22B16B]/10"
        style={{ top: (ITEM_H - BAND_H) / 2, height: BAND_H }}
      />
      <div
        ref={scroller} id={id} role="spinbutton" tabIndex={0} aria-label={label}
        aria-valuemin={Math.min(years[0]!, years[years.length - 1]!)} aria-valuemax={Math.max(years[0]!, years[years.length - 1]!)} aria-valuenow={years[active]} aria-valuetext={valueText(years[active]!)}
        onScroll={handleScroll} onKeyDown={(event) => { onInteract?.(); handleKeyDown(event); }}
        onPointerDown={onInteract} onWheel={onInteract} onTouchStart={onInteract}
        className="relative z-[1] h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[10px] outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-white/60 [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
        }}
      >
        <div style={{ paddingBottom: PAD_BOTTOM }}>
          {years.map((year, i) => (
            <div
              key={year} ref={(node) => { items.current[i] = node; }} aria-hidden="true"
              onClick={() => goTo(i, true)}
              className={`flex cursor-pointer snap-start items-center justify-center truncate px-2 text-center will-change-transform ${itemClassName} ${i === active ? "text-white" : "text-[#C4C4C4]"}`}
              style={{ height: ITEM_H }}
            >
              {valueText(year)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface YearWheelFieldProps {
  readonly label: string;
  /** Año confirmado, o `null` si todavía no se ha elegido. */
  readonly value: number | null;
  readonly onChange: (year: number) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
}

interface WheelStripProps {
  readonly label: string;
  readonly values: readonly number[];
  readonly value: number | null;
  readonly initial: number;
  readonly onChange: (value: number) => void;
  readonly format: (value: number) => string;
  readonly summary: string;
  /** Ancho de la tira (los países necesitan algo más que los números). */
  readonly widthClass?: string;
  readonly itemClassName?: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
}

/**
 * Tira estrecha con la rueda arriba y el botón de confirmar debajo, al estilo del selector del iPhone. El valor solo
 * cuenta cuando se confirma (con el botón o con Intro). La comparten el año de estreno y la duración.
 */
function WheelStrip({ label, values, value, initial, onChange, format, summary, widthClass = "w-[190px]", itemClassName, required, hint, error }: WheelStripProps) {
  const id = useId();
  const [pending, setPending] = useState<number>(() => value ?? initial);
  // Hasta que se toca la rueda, el botón solo invita a elegir; al empezar a girarla pasa a «Confirmar».
  const [hasInteracted, setHasInteracted] = useState(false);
  // El verde fijo solo aparece al confirmar en esta visita: al entrar (aunque el borrador ya tenga un valor guardado)
  // el botón sale sin colorear.
  const [hasConfirmedNow, setHasConfirmedNow] = useState(false);
  const isDone = hasConfirmedNow && value !== null && value === pending;
  const canConfirm = !isDone && (hasInteracted || value !== null);
  const confirm = () => { onChange(pending); setHasConfirmedNow(true); };
  const markInteracted = () => { setHasInteracted(true); setHasConfirmedNow(false); };

  return (
    // El ancho va en el contenedor para que la ayuda y el error se ajusten a la tira en vez de ensancharla.
    <div className={`${widthClass} max-w-full`}>
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <div
        className={`flex w-full flex-col items-stretch gap-1 rounded-[10px] border bg-black/40 px-3 pb-3 pt-2 ${
          error ? "border-[#ff5252]/60" : isDone ? "border-[#22B16B]/50" : "border-white/15"
        }`}
      >
        <Wheel id={id} label={label} years={values} initial={pending} onSettle={setPending} onEnter={confirm} onInteract={markInteracted} valueText={format} itemClassName={itemClassName} />
        {/* Tres estados: «Selecciona» (aún sin tocar), «Confirmar» (neutro; se ilumina al pasar por encima) y, recién
            confirmado, «Confirmar» en verde fijo sin texto extra. El nombre accesible añade el campo (hay tres botones). */}
        <button
          type="button" onClick={confirm} disabled={!canConfirm}
          aria-label={`${isDone ? "Confirmado" : canConfirm ? "Confirmar" : "Selecciona"} ${label}`}
          className={isDone ? `${CONFIRM_DONE} w-full` : canConfirm ? `${CONFIRM_IDLE} w-full` : `${SELECT_HINT} w-full`}
        >
          {canConfirm || isDone ? "Confirmar" : "Selecciona"}
        </button>
        <p aria-live="polite" className="text-center text-[12.5px] leading-5 text-[#A8A8A8]">
          {value !== null ? <>{summary}: <strong className="tabular-nums text-white">{format(value)}</strong></> : "Gira la rueda y confirma."}
        </p>
      </div>
    </FieldShell>
    </div>
  );
}

/** Año de estreno: rueda de años (del primer cine a dentro de dos años). */
export function YearWheelField({ label, value, onChange, required, hint, error }: YearWheelFieldProps) {
  const years = useYears();
  return (
    <WheelStrip label={label} values={years} value={value} initial={new Date().getFullYear()} onChange={onChange}
      format={String} summary="Año de estreno" required={required} hint={hint} error={error} />
  );
}
