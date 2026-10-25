"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { C } from "./studio-ui";
import {
  FREE_STORAGE_BYTES, FREE_STORAGE_GB, PLAN_MAX_GB, PLAN_MIN_GB, PLAN_STEP_GB, estimatePlan, formatBytes, storageLevel, suggestedPlanGB,
} from "@/lib/studio/storage-plan";

const LEVEL = {
  ok:       { color: C.accentH, text: () => "Tienes espacio de sobra." },
  warning:  { color: C.gold, text: () => "Estás cerca del límite." },
  critical: { color: C.error, text: () => "Casi no te queda espacio." },
  over:     { color: C.error, text: (limit: string) => `Has superado tus ${limit}: amplía el espacio para seguir subiendo.` },
} as const;

const euros = (value: number) => value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const RADIUS = 58;
const LENGTH = 2 * Math.PI * RADIUS;

/** Anillo de carga: arranca vacío y se llena hasta lo que ocupa el creador. */
function Gauge({ pct, color, usedLabel }: { readonly pct: number; readonly color: string; readonly usedLabel: string }) {
  const reduceMotion = useReducedMotion();
  const offset = LENGTH * (1 - pct / 100);
  return (
    <div className="relative size-[150px] shrink-0">
      <svg viewBox="0 0 140 140" aria-hidden="true" className="size-full -rotate-90">
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <motion.circle
          cx="70" cy="70" r={RADIUS} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={LENGTH}
          initial={{ strokeDashoffset: reduceMotion ? offset : LENGTH }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduceMotion ? 0 : 1.2, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.3 }}
          style={{ opacity: pct > 0 ? 1 : 0, filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-white">{pct}%</span>
        <span className="text-[12px] text-[#8A8A8A]">{usedLabel}</span>
      </div>
    </div>
  );
}

/**
 * Almacenamiento del creador frente a su cupo (los 5 GB gratis, o el que el equipo asigna a una cuenta gestionada, ver
 * docs/DIRECTORES-GESTIONADOS.md), en un anillo de carga. La calculadora de ampliación se abre encima del propio panel
 * (no debajo), así no cambia su tamaño ni descoloca el resto del Panel.
 */
export function StorageCard({ usedBytes: rawUsedBytes, limitBytes = FREE_STORAGE_BYTES, freeingBytes = 0, freeingCount = 0 }: {
  readonly usedBytes: number; readonly limitBytes?: number; readonly freeingBytes?: number; readonly freeingCount?: number;
}) {
  // Si el dato llega vacío o mal (texto, null), se cuenta como 0 en vez de pintar «NaN».
  const usedBytes = Number.isFinite(Number(rawUsedBytes)) ? Math.max(0, Number(rawUsedBytes)) : 0;
  const sliderId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const level = storageLevel(usedBytes, limitBytes);
  const style = LEVEL[level];
  const limitGB = Math.round((limitBytes / FREE_STORAGE_BYTES) * FREE_STORAGE_GB);
  const limitLabel = limitBytes === FREE_STORAGE_BYTES ? `${FREE_STORAGE_GB} GB gratis` : `${limitGB} GB del cupo del equipo`;
  const pct = Math.min(100, Math.round((usedBytes / limitBytes) * 100));
  const free = formatBytes(Math.max(0, limitBytes - usedBytes));
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [planGB, setPlanGB] = useState(() => Math.max(suggestedPlanGB(usedBytes), level === "ok" ? 50 : PLAN_MIN_GB + PLAN_STEP_GB));
  const plan = estimatePlan(planGB);

  const closeCalculator = () => {
    setIsCalculatorOpen(false);
    openButtonRef.current?.focus();
  };

  return (
    <div className="relative flex h-full flex-col p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-white">Almacenamiento</h2>
        <span className="text-[13px] text-[#8A8A8A]">{limitLabel}</span>
      </div>

      <div role="meter" aria-label="Espacio usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${formatBytes(usedBytes)} de ${limitGB} GB`}
        className="mt-5 flex flex-1 items-center gap-6">
        <Gauge pct={pct} color={style.color} usedLabel={`de ${limitGB} GB`} />
        <dl className="flex min-w-0 flex-col gap-3 text-[13.5px]">
          <div>
            <dt className="flex items-center gap-2 text-[#8A8A8A]"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: style.color }} />Usado</dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-white">{formatBytes(usedBytes)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-[#8A8A8A]"><span aria-hidden="true" className="size-2 rounded-full bg-white/20" />Libre</dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-white">{free}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-[13px] leading-5" style={{ color: level === "ok" ? "#A8A8A8" : style.color }}>{style.text(limitLabel)}</p>
      {freeingCount > 0 && (
        <p role="status" className="mt-2 flex items-center gap-2 text-[12.5px] text-[#8A8A8A]">
          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-white/50" />
          Liberando {freeingBytes > 0 ? formatBytes(freeingBytes) : "espacio"} de {freeingCount === 1 ? "1 obra eliminada" : `${freeingCount} obras eliminadas`}…
        </p>
      )}
      <button ref={openButtonRef} type="button" aria-expanded={isCalculatorOpen} onClick={() => setIsCalculatorOpen(true)}
        className="mt-3 inline-flex min-h-10 items-center justify-center self-start rounded-full border border-white/10 bg-white/[0.06] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-white">
        Calcular ampliación
      </button>

      <AnimatePresence>
        {isCalculatorOpen && (
          <motion.div
            role="dialog" aria-label="Calcular ampliación de espacio"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={(event) => { if (event.key === "Escape") closeCalculator(); }}
            className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-[#08120D]/95 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-semibold text-white">Calcular ampliación</h3>
              <button type="button" onClick={closeCalculator} aria-label="Cerrar calculadora"
                className="grid size-9 place-items-center rounded-full text-[#A8A8A8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-4"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <label htmlFor={sliderId} className="mt-4 flex items-center justify-between text-[13px] font-semibold text-[#C4C4C4]">
              <span>Espacio que necesitas</span>
              <span className="tabular-nums text-[#5FD39A]">{plan.totalGB} GB</span>
            </label>
            <input
              id={sliderId} type="range" min={PLAN_MIN_GB} max={PLAN_MAX_GB} step={PLAN_STEP_GB} value={planGB} autoFocus
              onChange={(event) => setPlanGB(Number(event.target.value))}
              aria-valuetext={`${plan.totalGB} GB, ${euros(plan.totalEur)} al mes`}
              className="mt-2 w-full" style={{ accentColor: C.accent }}
            />
            <div className="flex justify-between text-[11px] text-[#686868]"><span>{PLAN_MIN_GB} GB</span><span>{PLAN_MAX_GB} GB</span></div>

            <p aria-live="polite" className="mt-3 text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-white">
              {plan.extraGB === 0 ? "Gratis" : euros(plan.totalEur)}
              {plan.extraGB > 0 && <span className="text-[14px] font-medium text-[#A8A8A8]"> al mes</span>}
            </p>
            {plan.extraGB > 0 && (
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-y-1 text-[12.5px] text-[#A8A8A8]">
                <dt>Alojar {plan.extraGB} GB extra</dt><dd className="tabular-nums">{euros(plan.storageEur)}</dd>
                <dt>Comisión del pago con tarjeta</dt><dd className="tabular-nums">{euros(plan.feeEur)}</dd>
              </dl>
            )}
            <p className="mt-auto pt-3 text-[12px] leading-5 text-[#686868]">
              Precio a coste: es lo que nos cuesta alojar ese espacio cada mes. La ampliación todavía no se puede contratar desde aquí.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
