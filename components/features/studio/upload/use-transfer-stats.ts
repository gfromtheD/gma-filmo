"use client";

import { useEffect, useRef, useState } from "react";
import { etaSeconds, nextRate, type RateState } from "@/lib/studio/transfer-stats";
import type { UploadPhase } from "@/lib/studio/upload-draft";

/**
 * Velocidad, tiempo restante y tiempo transcurrido de la etapa en curso. La velocidad y el tiempo restante solo existen
 * al subir (las otras etapas no avanzan en bytes); el tiempo transcurrido se reinicia al cambiar de etapa.
 */
export function useTransferStats(phase: UploadPhase, progress: number | null, sizeBytes: number) {
  const rateState = useRef<RateState | null>(null);
  const startedAt = useRef(Date.now());
  const [rate, setRate] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    rateState.current = null;
    startedAt.current = Date.now();
    setRate(null);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "uploading" || progress === null) return;
    const next = nextRate(rateState.current, Date.now(), (progress / 100) * sizeBytes);
    rateState.current = next;
    setRate(next.rate);
  }, [phase, progress, sizeBytes]);

  const loaded = progress === null ? 0 : Math.min(sizeBytes, (progress / 100) * sizeBytes);
  return { loaded, rate, elapsed, eta: phase === "uploading" ? etaSeconds(sizeBytes - loaded, rate) : null };
}
