"use client";

import { formatElapsed, formatEta, formatMegabytes, formatRate } from "@/lib/studio/transfer-stats";
import { QUEUED_NOTE, type UploadPhase } from "@/lib/studio/upload-draft";
import { useTransferStats } from "./use-transfer-stats";

interface UploadProgressProps {
  readonly phase: UploadPhase;
  /** Avance (0–100) de la etapa en curso; `null` si esa etapa no lo informa. */
  readonly progress: number | null;
  readonly sizeBytes: number;
}

const PHASES: readonly { readonly id: UploadPhase; readonly label: string }[] = [
  { id: "checking", label: "Comprobar" },
  { id: "uploading", label: "Subir" },
  { id: "processing", label: "Procesar" },
];

/**
 * Cuánto de la barra de una etapa está lleno: las anteriores a la actual, completas; las siguientes, vacías. En cola el archivo
 * ya está comprobado y aún no ha empezado a subir: la barra de subir, vacía.
 */
function segmentFill(segment: UploadPhase, current: UploadPhase, progress: number | null): number {
  const order = PHASES.findIndex((p) => p.id === segment);
  const now = PHASES.findIndex((p) => p.id === (current === "queued" ? "uploading" : current));
  if (current === "queued" && order === now) return 0;
  if (order < now) return 100;
  if (order > now) return 0;
  return progress ?? 0;
}

/**
 * El paso 1 de un vistazo: el porcentaje de la etapa en curso en grande, las tres etapas (comprobar el archivo, subirlo,
 * procesarlo) cada una con su propia barra, y al subir, cuántos MB van, a qué velocidad y cuánto falta.
 */
export function UploadProgress({ phase, progress, sizeBytes }: UploadProgressProps) {
  const { loaded, rate, elapsed, eta } = useTransferStats(phase, progress, sizeBytes);
  const known = progress !== null && phase !== "processing" && phase !== "queued";

  return (
    <div className="w-full max-w-[420px] text-left" aria-hidden="true">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[34px] font-extrabold leading-none tabular-nums text-white">
          {known ? `${Math.round(progress)} %` : formatElapsed(elapsed)}
        </span>
        <span className="text-[12.5px] font-semibold text-[#2AC57A]">{phase === "queued" ? "En cola" : PHASES.find((p) => p.id === phase)?.label}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {PHASES.map(({ id, label }) => {
          const fill = segmentFill(id, phase, progress);
          const active = id === (phase === "queued" ? "uploading" : phase);
          const sweeping = active && phase === "processing";
          return (
            <div key={id}>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                {sweeping ? (
                  <div className="absolute inset-y-0 w-2/5 animate-[gma-sweep_1.6s_ease-in-out_infinite] rounded-full bg-[#22B16B] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
                ) : (
                  <div className="h-full rounded-full bg-[#22B16B] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${fill}%` }} />
                )}
              </div>
              <p className={`mt-1 text-[11.5px] font-semibold ${active ? "text-white" : fill === 100 ? "text-[#2AC57A]" : "text-[#6F6F6F]"}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {phase === "uploading" && (
        <p className="mt-2 text-[12.5px] tabular-nums text-[#BBBBBB]">
          {formatMegabytes(loaded)} de {formatMegabytes(sizeBytes)}
          {rate !== null && <> · {formatRate(rate)}</>}
          {eta !== null && <> · {formatEta(eta)}</>}
        </p>
      )}
      {phase === "checking" && <p className="mt-2 text-[12.5px] text-[#BBBBBB]">Verificando que el archivo está entero antes de enviarlo…</p>}
      {phase === "queued" && <p className="mt-2 text-[12.5px] text-[#BBBBBB]">{QUEUED_NOTE}</p>}
      {phase === "processing" && <p className="mt-2 text-[12.5px] text-[#BBBBBB]">El servidor lo está convirtiendo: puedes seguir rellenando la ficha.</p>}
    </div>
  );
}
