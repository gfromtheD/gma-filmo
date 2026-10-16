"use client";

import Link from "next/link";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD_CLASS, CheckboxField } from "./fields";
import { countryName, languageName } from "@/lib/studio/geo";
import type { SubmitResult } from "@/lib/studio/engine";
import { isReadyToSubmit, type StepReview, type UploadDraft, type UploadStepId } from "@/lib/studio/upload-draft";

interface ReviewPageProps {
  readonly draft: UploadDraft;
  readonly update: (patch: Partial<UploadDraft>) => void;
  readonly reviews: readonly StepReview[];
  readonly goToStep: (id: UploadStepId) => void;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
  readonly onGoToTitles?: () => void;
  readonly isSubmitting: boolean;
  readonly result: SubmitResult | null;
  readonly engineConnected: boolean;
}

const doneUrl = (asset: { readonly status: string; readonly url: string | null } | null) => (asset?.status === "done" ? asset.url : null);

/** Agrupa a las personas por papel: «Director/a: Ana Pérez». */
function teamByRole(draft: UploadDraft): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const m of draft.team) {
    if (!m.name.trim() || !m.role) continue;
    groups.set(m.role, [...(groups.get(m.role) ?? []), m.name.trim()]);
  }
  return [...groups.entries()];
}

const CHIP = "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] text-[#E0E0E0]";

/**
 * Última pantalla de la subida: no es un paso, es la vista previa de la ficha ya rellenada, con lo que falta (si algo
 * falta) y el botón de enviar a revisión.
 */
export function ReviewPage({ draft, update, reviews, goToStep, onBack, onSubmit, onGoToTitles, isSubmitting, result, engineConnected }: ReviewPageProps) {
  const ready = isReadyToSubmit(draft);
  const pending = reviews.filter((r) => r.status === "incomplete");
  const banner = doneUrl(draft.images.banner);
  const poster = doneUrl(draft.images.poster);
  const meta = [
    draft.releaseYear ? String(draft.releaseYear) : "", draft.durationMinutes ? `${draft.durationMinutes} min` : "",
    draft.productionCountry ? countryName(draft.productionCountry) : "", draft.language ? languageName(draft.language) : "",
    draft.ageRating,
  ].filter(Boolean);
  const chips = [...draft.categories, ...draft.genres, ...draft.themes, ...(draft.firstFilm ? ["Ópera prima"] : [])];
  const sent = result !== null && result.status !== "error";

  return (
    <section aria-labelledby="review-title" className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      <header>
        <h2 id="review-title" className="text-[26px] font-extrabold leading-tight text-white">Revisar y enviar</h2>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-6 text-[#BBBBBB]">
          Así se verá tu ficha. Si todo está bien, envíala: pasará una revisión antes de publicarse.
        </p>
      </header>

      <article aria-label="Vista previa de la ficha" className="overflow-hidden rounded-[14px] border border-white/10 bg-black/40 backdrop-blur-md">
        <div className="relative aspect-video w-full bg-gradient-to-br from-white/10 to-white/[0.02]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {banner ? <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <p className="absolute inset-0 grid place-items-center text-[13px] text-[#7C7C7C]">Sin banner</p>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8">
            <h3 className="break-words text-[26px] font-extrabold leading-tight text-white sm:text-[38px]">{draft.title || "Sin título"}</h3>
            {meta.length > 0 && <p className="mt-1 text-[14px] text-[#D0D0D0]">{meta.join(" · ")}</p>}
            {draft.synopsisShort && <p className="mt-2 line-clamp-3 max-w-[60ch] text-[15px] leading-6 text-white/90">{draft.synopsisShort}</p>}
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-8">
          <div className="aspect-[595/842] w-[120px] overflow-hidden rounded-[8px] bg-white/5 sm:w-[150px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {poster ? <img src={poster} alt="Cartel" className="h-full w-full object-cover" /> : <p className="grid h-full place-items-center px-2 text-center text-[12px] text-[#7C7C7C]">Sin cartel</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {draft.synopsisLong && <p className="whitespace-pre-line text-[15px] leading-7 text-[#D8D8D8]">{draft.synopsisLong}</p>}
            {chips.length > 0 && (
              <ul aria-label="Categorías, géneros y temáticas" className="flex flex-wrap gap-2">
                {chips.map((c) => <li key={c} className={CHIP}>{c}</li>)}
              </ul>
            )}
            {teamByRole(draft).length > 0 && (
              <dl className="grid gap-x-4 gap-y-1 text-[14px] sm:grid-cols-[auto_1fr]">
                {teamByRole(draft).map(([role, names]) => (
                  <div key={role} className="contents">
                    <dt className="text-[#A8A8A8]">{role}</dt>
                    <dd className="text-white">{names.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            )}
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#A8A8A8]">
              {draft.originalTitle.trim() && <li>Título original: {draft.originalTitle}</li>}
              {draft.trailer.file && <li>Con tráiler</li>}
              {draft.extras.length > 0 && <li>{draft.extras.length} {draft.extras.length === 1 ? "extra" : "extras"}</li>}
              {draft.srtSubtitles.length > 0 && <li>Subtítulos: {draft.srtSubtitles.map((s) => languageName(s.language)).join(", ")}</li>}
              {draft.awards.length > 0 && <li>{draft.awards.length} {draft.awards.length === 1 ? "premio o selección" : "premios y selecciones"}</li>}
              {draft.ai.used && <li>Aviso: puede contener contenido creado con IA</li>}
            </ul>
          </div>
        </div>
      </article>

      {pending.length > 0 && (
        <div role="alert" className={`${CARD_CLASS} border-[#E8B84B]/40`}>
          <h3 className="text-[17px] font-bold text-[#F0D58A]">Antes de enviar te falta…</h3>
          <ul className="mt-3 flex flex-col divide-y divide-white/10">
            {pending.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-white">{r.label}</p>
                  <ul className="mt-1 list-disc pl-5 text-[13.5px] text-[#E8B84B]">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
                <button type="button" onClick={() => goToStep(r.id)} className="shrink-0 text-[13px] font-bold text-[#22B16B] underline-offset-2 hover:underline">
                  Ir al paso
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${CARD_CLASS} flex flex-col gap-4`}>
        <CheckboxField label="Permitir comentarios en la ficha" checked={draft.allowComments} onChange={(v) => update({ allowComments: v })} />
        <CheckboxField
          label={<>Confirmo que soy propietario/a de la obra o tengo permiso para publicarla, y acepto los <Link href="/terminos" target="_blank" className="font-bold text-[#22B16B] underline">términos de uso</Link>.</>}
          checked={draft.acceptedTerms} onChange={(v) => update({ acceptedTerms: v })}
        />
        {!engineConnected && (
          <p className="rounded-[8px] border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-3 text-[13.5px] leading-5 text-[#F0D58A]">
            El motor de subida todavía no está conectado: tu título queda preparado y comprobado, y el envío se completará cuando se conecte.
          </p>
        )}
        {!ready && <p className="text-[13px] text-[#A8A8A8]">El botón se activa cuando todo está completo y aceptas los términos.</p>}
        {result && (
          <p role={result.status === "error" ? "alert" : "status"} className={`rounded-[8px] p-3 text-[14px] ${result.status === "error" ? "bg-[#ff5252]/10 text-[#ff9b9b]" : "bg-[#22B16B]/10 text-[#7BE0AC]"}`}>
            {result.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>Volver a editar</button>
        {sent && onGoToTitles ? (
          <button type="button" onClick={onGoToTitles} className={BUTTON_PRIMARY}>Ver mis títulos</button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={!ready || isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? "Enviando…" : "Enviar a revisión"}
          </button>
        )}
      </div>
    </section>
  );
}
