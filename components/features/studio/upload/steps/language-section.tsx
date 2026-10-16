"use client";

import { BUTTON_SECONDARY, CARD_CLASS, SelectField } from "../fields";
import { FileSlot } from "../file-slot";
import { languageOptions } from "../options";
import { errorIf, type StepProps } from "../step-props";
import { LIMITS } from "@/lib/studio/catalogs";

export function LanguageSection({ draft, update, files, showErrors }: StepProps) {
  const languages = languageOptions();
  const srt = draft.srtSubtitles;
  const canAdd = srt.length < LIMITS.srtFiles;

  const patchSrt = (index: number, language: string) =>
    update({ srtSubtitles: srt.map((s, i) => (i === index ? { ...s, language } : s)) });

  const removeSrt = (index: number) => {
    // los huecos de archivo se numeran: al quitar uno se descartan los archivos y se reordenan
    srt.forEach((_, i) => files.remove(`srt:${i}`));
    update({ srtSubtitles: srt.filter((_, i) => i !== index).map((s) => ({ ...s, file: null })) });
  };

  return (
    <>
      <div className={CARD_CLASS}>
        <SelectField label="Idioma original" required value={draft.language} options={languages} onChange={(v) => update({ language: v })}
          hint="El idioma en el que se habla la obra (el audio)."
          error={errorIf(showErrors, !draft.language, "Elige el idioma original.")} />
      </div>

      <div className={CARD_CLASS}>
        <h3 className="text-[17px] font-bold text-white">Archivos de subtítulos (.srt)</h3>
        <p className="mt-1 text-[14px] text-[#A8A8A8]">Hasta {LIMITS.srtFiles} archivos, cada uno con su idioma. Se activan desde el reproductor.</p>
        <ul className="mt-4 flex flex-col gap-4">
          {srt.map((s, i) => (
            <li key={i} className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <SelectField label={`Idioma del SRT ${i + 1}`} value={s.language} options={languages} onChange={(v) => patchSrt(i, v)}
                error={errorIf(showErrors, !s.language, "Elige el idioma.")} />
              <div className="flex flex-col gap-2">
                <FileSlot label={`Subtítulos ${i + 1}`} required rules="Archivo .srt · hasta 5 MB" accept=".srt" asset={s.file}
                  onFile={(f) => files.upload(`srt:${i}`, "subtitle", f)} onRemove={() => files.remove(`srt:${i}`)} compact />
                <button type="button" onClick={() => removeSrt(i)} className="self-start text-[13px] font-semibold text-[#ff7b7b] underline-offset-2 hover:underline">
                  Quitar este idioma
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" disabled={!canAdd} onClick={() => update({ srtSubtitles: [...srt, { language: "", file: null }] })} className={`${BUTTON_SECONDARY} mt-4`}>
          Añadir subtítulos
        </button>
      </div>
    </>
  );
}
