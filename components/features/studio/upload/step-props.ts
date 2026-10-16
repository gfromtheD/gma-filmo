import type { PixelSize } from "@/lib/studio/file-rules";
import type { FileRuleKind } from "@/lib/studio/file-rules";
import type { StepReview, UploadDraft } from "@/lib/studio/upload-draft";

/** Lo que recibe cada paso de la pasarela. */
export interface StepProps {
  readonly draft: UploadDraft;
  /** Cambia partes del borrador (se mezclan con lo que hay). */
  readonly update: (patch: Partial<UploadDraft>) => void;
  readonly files: {
    readonly upload: (slot: string, rule: FileRuleKind, file: File, suggested?: PixelSize) => void;
    readonly remove: (slot: string) => void;
    readonly advice: Readonly<Record<string, string | null>>;
  };
  readonly review: StepReview;
  /** Tras intentar avanzar con carencias, se enseñan los errores de cada campo. */
  readonly showErrors: boolean;
}

/** Devuelve el mensaje de error solo cuando ya se pidió avanzar y la condición se cumple. */
export const errorIf = (show: boolean, failing: boolean, message: string): string | null => (show && failing ? message : null);
