"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./fields";
import { PUBLISHES_DIRECTLY, ReviewPage } from "./review-page";
import { PublishedScreen, PublishingScreen } from "./publish-screens";
import { useAssetUploader } from "./use-asset-uploader";
import type { StepProps } from "./step-props";
import { VideoStep } from "./steps/video-step";
import { FichaStep } from "./steps/ficha-step";
import { DataStep } from "./steps/data-step";
import { useFooterHiddenStore } from "@/store/use-footer-hidden-store";
import { getUploadEngine, type SubmitResult } from "@/lib/studio/engine";
import { clearDraft, loadDraft, saveDraft } from "@/lib/studio/draft-storage";
import { UPLOAD_STEPS, emptyDraft, processingAssets, reviewDraft, setAsset, type UploadDraft, type UploadStepId } from "@/lib/studio/upload-draft";

const SAVE_DELAY_MS = 500;

/** Estado visible de un paso: neutro al principio (se le da el beneficio de la duda al usuario) y aviso solo si salió sin completarlo. */
type StepMark = "complete" | "warning" | "pending";
const STATUS_CLASS: Record<StepMark, string> = {
  complete: "border-[#22B16B] bg-[#22B16B] text-[#031A0E]",
  warning: "border-[#E8B84B] bg-[#E8B84B]/15 text-[#E8B84B]",
  pending: "border-white/25 text-transparent",
};

interface UploadWizardProps {
  /** Se llama al terminar o al querer ver los títulos. */
  readonly onGoToTitles?: () => void;
}

/**
 * Pasarela de subida: tres pasos (vídeo, ficha, datos) con su estado a la izquierda y, al terminar, una página aparte
 * para revisar la ficha y enviarla. El borrador se guarda solo y el motor se maneja únicamente a través
 * de `UploadEngine` (ver `lib/studio/engine.ts`).
 */
export function UploadWizard({ onGoToTitles }: UploadWizardProps) {
  // El motor multimedia necesita leer el borrador actual (tipo de cada extra, idioma de cada SRT) sin recrearse.
  const draftRef = useRef<UploadDraft | null>(null);
  const engine = useMemo(() => getUploadEngine(() => draftRef.current ?? emptyDraft()), []);
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  draftRef.current = draft;
  const [isReady, setIsReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [attempted, setAttempted] = useState<ReadonlySet<UploadStepId>>(new Set());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  /** Obra recién enviada: se enseña la confirmación en vez de volver al formulario (que ya está vacío). */
  const [sent, setSent] = useState<{ readonly title: string; readonly slug: string | null; readonly published: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const skipFocus = useRef(true);

  // El borrador se lee en el navegador al montar (en el servidor no existe `localStorage`).
  useEffect(() => {
    setDraft(loadDraft(window.localStorage));
    setIsReady(true);
  }, []);

  // Guardado automático con un pequeño retraso. Mientras sube un vídeo la barra de progreso cambia el borrador sin parar y
  // el retraso se reiniciaría siempre: por eso se guarda igualmente si ya ha pasado SAVE_DELAY_MS desde el último guardado.
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!isReady) return;
    const save = () => { saveDraft(window.localStorage, draft); lastSaveRef.current = Date.now(); setSavedAt(lastSaveRef.current); };
    const timer = setTimeout(save, Math.max(0, SAVE_DELAY_MS - (Date.now() - lastSaveRef.current)));
    return () => clearTimeout(timer);
  }, [draft, isReady]);

  // Al cambiar de paso o de pantalla, el foco pasa al contenido (accesibilidad) y se sube al principio.
  useEffect(() => {
    if (skipFocus.current) { skipFocus.current = false; return; }
    panel.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex, isReviewing]);

  // El pie de la web solo aparece en la revisión final; durante la edición estorba.
  const setFooterHidden = useFooterHiddenStore((state) => state.setHidden);
  useEffect(() => {
    setFooterHidden(!isReviewing);
    return () => setFooterHidden(false);
  }, [isReviewing, setFooterHidden]);

  const update = useCallback((patch: Partial<UploadDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const setAssetInDraft = useCallback((slot: string, asset: Parameters<typeof setAsset>[2]) => setDraft((d) => setAsset(d, slot, asset)), []);
  const uploader = useAssetUploader(engine, setAssetInDraft);

  // Al volver a la página, lo que el servidor seguía convirtiendo se vuelve a vigilar (una sola vez, con el borrador recién leído).
  const resumed = useRef(false);
  const { resume } = uploader;
  useEffect(() => {
    if (!isReady || resumed.current) return;
    resumed.current = true;
    for (const [slot, asset] of processingAssets(draftRef.current ?? emptyDraft())) void resume(slot, asset);
  }, [isReady, resume]);

  const reviews = useMemo(() => reviewDraft(draft), [draft]);
  const step = UPLOAD_STEPS[stepIndex]!;
  const review = reviews[stepIndex]!;
  const completeCount = reviews.filter((r) => r.status === "complete").length;
  const showErrors = attempted.has(step.id);
  const isLastStep = stepIndex === UPLOAD_STEPS.length - 1;

  const goTo = (index: number) => {
    // salir de un paso con carencias lo marca para enseñar los errores al volver
    if (review.status === "incomplete") setAttempted((s) => new Set(s).add(step.id));
    setStepIndex(Math.min(Math.max(index, 0), UPLOAD_STEPS.length - 1));
  };

  const startReview = () => {
    setAttempted(new Set(UPLOAD_STEPS.map((s) => s.id)));
    setIsReviewing(true);
  };

  const goToStep = (id: UploadStepId) => {
    setStepIndex(UPLOAD_STEPS.findIndex((s) => s.id === id));
    setIsReviewing(false);
  };

  async function submit() {
    const title = draft.title.trim();
    setIsSubmitting(true);
    const outcome = await engine.submit(draft);
    setResult(outcome);
    setIsSubmitting(false);
    if (outcome.status === "error") return;
    // Enviada: la confirmación sustituye a la revisión y el borrador empieza de cero para la siguiente obra.
    setSent({ title, slug: outcome.status === "published" ? outcome.slug || null : null, published: outcome.status === "published" });
    if (outcome.status === "published") { clearDraft(window.localStorage); setDraft(emptyDraft()); }
  }

  function startOver() {
    clearDraft(window.localStorage);
    setDraft(emptyDraft());
    setAttempted(new Set());
    setResult(null);
    setSent(null);
    setStepIndex(0);
    setIsReviewing(false);
    setConfirmReset(false);
  }

  if (!isReady) return <p role="status" className="py-10 text-[15px] text-[#A8A8A8]">Cargando tu borrador…</p>;

  if (sent) {
    return (
      <div ref={panel} tabIndex={-1} className="min-w-0 outline-none">
        <PublishedScreen title={sent.title} slug={sent.slug} published={sent.published} onGoToTitles={onGoToTitles} onNewUpload={startOver} />
      </div>
    );
  }

  if (isReviewing && isSubmitting) {
    return (
      <div ref={panel} tabIndex={-1} className="min-w-0 outline-none">
        <PublishingScreen title={draft.title.trim()} publishes={PUBLISHES_DIRECTLY} />
      </div>
    );
  }

  if (isReviewing) {
    return (
      <div ref={panel} tabIndex={-1} className="min-w-0 outline-none">
        <ReviewPage
          draft={draft} update={update} reviews={reviews} goToStep={goToStep} onBack={() => setIsReviewing(false)}
          onSubmit={() => void submit()} onGoToTitles={onGoToTitles} isSubmitting={isSubmitting} result={result}
        />
      </div>
    );
  }

  const stepProps: StepProps = {
    draft, update, review, showErrors,
    files: {
      upload: (slot, rule, file, suggested) => void uploader.upload({ slot, rule, file }, suggested),
      remove: uploader.remove,
      advice: uploader.advice,
    },
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-24">
        <nav aria-label="Pasos de la subida">
          <p className="mb-3 text-[13px] font-semibold text-[#A8A8A8]" aria-live="polite">
            {completeCount} de {UPLOAD_STEPS.length} pasos completos
          </p>
          <ol className="relative flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {UPLOAD_STEPS.map((s, i) => {
              const r = reviews[i]!;
              const active = i === stepIndex;
              const mark: StepMark = r.status === "complete" ? "complete" : attempted.has(s.id) ? "warning" : "pending";
              return (
                <li key={s.id} className="shrink-0 lg:shrink">
                  <button
                    type="button" onClick={() => goTo(i)} aria-current={active ? "step" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                      active ? "bg-white/10 text-white" : "text-[#C4C4C4] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-[#A8A8A8]">Paso {i + 1}</span>
                      <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
                    </span>
                    <span className="sr-only">{mark === "complete" ? " (completo)" : mark === "warning" ? " (incompleto)" : ""}</span>
                    <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[13px] font-extrabold ${STATUS_CLASS[mark]}`}>
                      {mark === "complete" ? "✓" : mark === "warning" ? "!" : "·"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="mt-4 hidden text-[12.5px] text-[#7C7C7C] lg:block">
          <p aria-live="polite">{savedAt ? "Borrador guardado." : "El borrador se guarda solo."}</p>
          {confirmReset ? (
            <p className="mt-2">¿Borrar todo y empezar de cero?{" "}
              <button type="button" onClick={startOver} className="font-bold text-[#ff7b7b] underline">Sí, borrar</button>{" · "}
              <button type="button" onClick={() => setConfirmReset(false)} className="font-bold underline">Cancelar</button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmReset(true)} className="mt-2 underline-offset-2 hover:underline">Empezar de cero</button>
          )}
        </div>
      </aside>

      <div ref={panel} tabIndex={-1} className="min-w-0 outline-none">
        {showErrors && review.status === "incomplete" && (
          <p role="alert" className="mb-5 rounded-[8px] border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-3 text-[13.5px] leading-5 text-[#F0D58A]">
            Para completar este paso te falta: {review.missing.join(", ")}.
          </p>
        )}

        {step.id === "video" && <VideoStep {...stepProps} />}
        {step.id === "ficha" && <FichaStep {...stepProps} />}
        {step.id === "datos" && <DataStep {...stepProps} />}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0} className={BUTTON_SECONDARY}>Anterior</button>
          {isLastStep
            ? <button type="button" onClick={startReview} className={BUTTON_PRIMARY}>Revisar y enviar</button>
            : <button type="button" onClick={() => goTo(stepIndex + 1)} className={BUTTON_PRIMARY}>Siguiente</button>}
        </div>
      </div>
    </div>
  );
}
