"use client";

import { SelectField } from "../fields";
import { FileSlot } from "../file-slot";
import { languageOptions } from "../options";
import { AddRowButton, ColumnHeads, RemoveRowButton } from "../sheet-row";
import { errorIf, type StepProps } from "../step-props";
import { LIMITS } from "@/lib/studio/catalogs";

const ROW = "sm:grid-cols-[200px_minmax(0,1fr)_44px]";

/** Idioma original (obligatorio) y, debajo, archivos de subtítulos con su idioma. */
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
    <div className="flex flex-col gap-7">
      <div className="max-w-[320px]">
        <SelectField label="Idioma original" required value={draft.language} options={languages} onChange={(v) => update({ language: v })}
          hint="El idioma en el que se habla la obra."
          error={errorIf(showErrors, !draft.language, "Elige el idioma original.")} />
      </div>

      <div className="flex flex-col">
        <p className="text-[14px] font-bold text-white">Subtítulos <span className="ml-1 text-[12px] font-medium text-[#7C7C7C]">Opcional</span></p>
        <p className="mb-3 mt-0.5 text-[13px] leading-5 text-[#A8A8A8]">Archivos .srt de hasta 5 MB, uno por idioma (hasta {LIMITS.srtFiles}). Se eligen desde el reproductor.</p>
        {srt.length > 0 && <ColumnHeads columns={["Idioma", "Archivo", ""]} template={ROW} />}
        <ul className="flex flex-col gap-3">
          {srt.map((s, i) => (
            <li key={i} className={`grid items-start gap-2 sm:gap-4 ${ROW}`}>
              <SelectField label={`Idioma del SRT ${i + 1}`} labelHidden value={s.language} options={languages} onChange={(v) => patchSrt(i, v)}
                placeholder="Idioma" error={errorIf(showErrors, !s.language, "Elige el idioma.")} />
              <FileSlot label={`Subtítulos ${i + 1}`} required rules="Archivo .srt · hasta 5 MB" accept=".srt" asset={s.file}
                onFile={(f) => files.upload(`srt:${i}`, "subtitle", f)} onRemove={() => files.remove(`srt:${i}`)} compact />
              <RemoveRowButton label={`Quitar los subtítulos ${i + 1}`} onClick={() => removeSrt(i)} />
            </li>
          ))}
        </ul>
        <AddRowButton disabled={!canAdd} onClick={() => update({ srtSubtitles: [...srt, { language: "", file: null }] })}>
          Añadir subtítulos
        </AddRowButton>
      </div>
    </div>
  );
}
