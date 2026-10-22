"use client";

import { CARD_CLASS, StepHeading, TextAreaField, TextField } from "../fields";
import { ExtrasSection } from "../extras-section";
import { ImageDrop } from "../image-drop";
import { ImageErrors, ImagePreviews, type ImageFeedbackItem } from "../image-feedback";
import { errorIf, type StepProps } from "../step-props";
import { IMAGE_SLOTS, LIMITS, type ImageSlotId } from "@/lib/studio/catalogs";

/**
 * «Crea tu ficha»: una plantilla de la página del título, todavía vacía. El banner, el cartel, el título y la sinopsis se
 * rellenan justo donde se verán; debajo, los detalles (sinopsis larga), el tráiler y los extras.
 */
export function FichaStep(props: StepProps) {
  const { draft, update, files, showErrors } = props;
  const drop = (id: ImageSlotId, className: string, placeholder?: React.ReactNode, adviceClassName?: string, doneBadge?: "tick" | "chip") => {
    const spec = IMAGE_SLOTS.find((s) => s.id === id)!;
    return (
      <ImageDrop
        label={spec.label} required={spec.required} asset={draft.images[id]} className={className} placeholder={placeholder}
        hint={`${spec.width} × ${spec.height} px`} advice={files.advice[id]} adviceClassName={adviceClassName} doneBadge={doneBadge} hideError
        onFile={(f) => files.upload(id, "image", f, { width: spec.width, height: spec.height })}
        onRemove={() => files.remove(id)}
      />
    );
  };

  const feedback: ImageFeedbackItem[] = IMAGE_SLOTS.map((spec) => ({
    id: spec.id, label: spec.label, asset: draft.images[spec.id], aspect: `${spec.width} / ${spec.height}`,
  }));

  return (
    <section aria-labelledby="step-ficha" className="flex flex-col gap-6">
      <div id="step-ficha">
        <StepHeading title="Crea tu ficha" intro="Esta es la página de tu título, todavía vacía. Pulsa cada zona para rellenarla: JPG, PNG, WebP o AVIF de hasta 10 MB cada imagen (máximo 25 megapíxeles)." />
      </div>

      <ImageErrors items={feedback} />

      <div className="overflow-hidden rounded-[14px] border border-white/10 bg-black/40 backdrop-blur-md">
        {drop("banner", "aspect-video w-full rounded-none border-0", <span aria-hidden="true" className="mb-1 text-[28px] text-white/30">▭</span>,
          // el cartel se monta sobre la esquina izquierda del banner: el aviso va a la derecha, por encima, sin tocarlo
          "relative z-[4] mr-4 mt-2 max-w-[calc(100%-160px)] self-end justify-end text-right sm:mr-8 sm:max-w-[calc(100%-240px)]", "chip")}

        <div className="relative z-[3] -mt-14 grid gap-5 px-4 pb-6 sm:-mt-24 sm:grid-cols-[170px_minmax(0,1fr)] sm:px-8">
          <div className="w-[120px] self-start shadow-[0_12px_32px_rgba(0,0,0,0.6)] sm:w-[170px]">
            {drop("poster", "aspect-[595/842] w-full", <span aria-hidden="true" className="mb-1 text-[28px] text-white/30">▯</span>)}
          </div>
          <div className="flex min-w-0 flex-col gap-4 sm:pt-28">
            <TextField label="Título" required value={draft.title} onChange={(v) => update({ title: v })}
              error={errorIf(showErrors, !draft.title.trim(), "Escribe el título.")} />
            <TextField label="Título original" value={draft.originalTitle} onChange={(v) => update({ originalTitle: v })} maxLength={LIMITS.originalTitleChars}
              hint="Solo si es distinto del título." />
            <TextAreaField label="Sinopsis corta" required rows={3} maxLength={LIMITS.shortSynopsisChars} value={draft.synopsisShort}
              onChange={(v) => update({ synopsisShort: v })} hint="Una o dos frases que enganchen: se ve sobre el banner."
              error={errorIf(showErrors, !draft.synopsisShort.trim(), "Escribe la sinopsis corta.")} />
          </div>
        </div>
      </div>

      <ImagePreviews items={feedback} />

      <div className={CARD_CLASS}>
        <TextAreaField label="Sinopsis larga" required rows={7} maxLength={LIMITS.longSynopsisChars} value={draft.synopsisLong} onChange={(v) => update({ synopsisLong: v })}
          hint="Cuenta la historia con más detalle: aparece en «Detalles» de la ficha."
          error={errorIf(showErrors, !draft.synopsisLong.trim(), "Escribe la sinopsis larga.")} />
      </div>

      <ExtrasSection {...props} />
    </section>
  );
}
