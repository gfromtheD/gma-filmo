"use client";

import { useId, useRef, useState } from "react";
import { Check, CloudUpload } from "@/components/ui/icons";
import { BUTTON_SECONDARY } from "./fields";
import { HaloSurface, type HaloTone } from "./halo-surface";
import { ProcessingBucket } from "./processing-bucket";
import type { StepProps } from "./step-props";
import type { UploadedAsset } from "@/lib/studio/upload-draft";

interface VideoDropzoneProps {
  /** Hueco del borrador: `video` o `trailer`. */
  readonly slot: "video" | "trailer";
  /** Cómo se llama en pantalla: «vídeo» o «tráiler». */
  readonly noun: string;
  readonly file: UploadedAsset | null;
  readonly files: StepProps["files"];
  readonly showErrors: boolean;
  readonly required?: boolean;
  /** `large` ocupa casi toda la altura de la pantalla (la película); `compact` es una caja baja (el tráiler). */
  readonly size?: "large" | "compact";
}

const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const ACCEPT = "video/*,.mkv,.mxf";

/**
 * Caja para soltar un vídeo encima o pulsar para elegirlo. Muestra el progreso mientras sube y, al terminar, el nombre
 * y el peso con la opción de cambiarlo o quitarlo.
 */
export function VideoDropzone({ slot, noun, file, files, showErrors, required = false, size = "compact" }: VideoDropzoneProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const label = `Archivo de ${noun}`;
  const status = file?.status;
  // La película (grande) se representa con la cubeta desde que empieza la subida; el tráiler, más pequeño, con una barra.
  const showsBucket = slot === "video" && (status === "uploading" || status === "processing");

  function pick(list: FileList | null) {
    const picked = list?.[0];
    if (picked) files.upload(slot, "video", picked);
    if (input.current) input.current.value = "";
  }

  const tone: HaloTone = status === "error" ? "error" : status === "done" ? "success" : "default";
  const height = size === "large" ? "min-h-[260px] md:min-h-[clamp(260px,calc(100svh-620px),640px)] lg:min-h-[clamp(240px,calc(100svh-460px),640px)]" : "min-h-[220px]";

  return (
    <div data-file-slot={label} className="flex min-w-0 flex-col gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsOver(false); pick(e.dataTransfer.files); }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <HaloSurface
        active={isOver || isHovered || isFocused} tone={tone}
        className={`flex ${height} flex-col items-center justify-center gap-3 p-6 text-center`}
      >
        <input
          ref={input} id={id} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files)} className="peer sr-only"
          onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
        />

        {!file && (
          <label htmlFor={id} className="absolute inset-0 z-[1] cursor-pointer rounded-[14px] peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-white">
            <span className="sr-only">Elegir {label.toLowerCase()}</span>
          </label>
        )}

        {!file && (
          <>
            <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white">
              <CloudUpload size={28} strokeWidth={1.7} />
            </span>
            <div>
              <p className="text-[17px] font-extrabold text-white">
                {isOver ? "Suéltalo aquí" : `Arrastra tu ${noun} aquí`}
                {required && <span className="ml-1 text-[#22B16B]" aria-hidden="true">*</span>}
                {required && <span className="sr-only"> (obligatorio)</span>}
              </p>
              <p className="mt-1 text-[14px] text-[#BBBBBB]">o pulsa para elegirlo desde tu equipo</p>
            </div>
            <span aria-hidden="true" className={`${BUTTON_SECONDARY} pointer-events-none`}>Elegir archivo</span>
            <p className="text-[12.5px] text-[#7C7C7C]">MP4, MOV, MKV… hasta 4 GB</p>
          </>
        )}

        {file && showsBucket && (
          <>
            <ProcessingBucket phase={status === "processing" ? "processing" : "uploading"} className="mt-10" />
            <div className="min-w-0 max-w-full">
              <p className="text-[17px] font-extrabold text-white">{status === "processing" ? `Procesando tu ${noun}` : `Subiendo tu ${noun}`}</p>
              <p className="mx-auto mt-1 max-w-[46ch] text-[14px] text-[#BBBBBB]">
                {status === "processing"
                  ? "Lo convertimos y optimizamos para que se vea bien en cualquier dispositivo. Con obras largas puede tardar un poco."
                  : "Mantén esta página abierta hasta que termine."}
              </p>
              <p className="mt-2 truncate text-[13px] text-[#7C7C7C]">{file.name} · {fmtBytes(file.sizeBytes)}</p>
            </div>
            <button type="button" onClick={() => files.remove(slot)} aria-label={`Cancelar ${label}`} className={BUTTON_SECONDARY}>Cancelar</button>
          </>
        )}

        {file && !showsBucket && (
          <>
            <span aria-hidden="true" className={`grid h-14 w-14 place-items-center rounded-full ${status === "done" ? "bg-[#22B16B] text-[#031A0E]" : "bg-white/10 text-white"}`}>
              {status === "done" ? <Check size={28} strokeWidth={2.5} /> : <CloudUpload size={28} strokeWidth={1.7} />}
            </span>
            <div className="min-w-0 max-w-full">
              <p className="truncate text-[16px] font-bold text-white">{file.name}</p>
              <p className="text-[13px] text-[#A8A8A8]">
                {fmtBytes(file.sizeBytes)}
                {status === "done" && <span className="ml-2 font-bold text-[#2AC57A]">Subido</span>}
              </p>
            </div>
            {status === "uploading" && (
              <div className="w-full max-w-[420px]">
                <div role="progressbar" aria-label={`Subiendo ${label.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(file.progress ?? 0)} className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#22B16B] transition-[width]" style={{ width: `${file.progress ?? 0}%` }} />
                </div>
                <p className="mt-1.5 text-[13px] tabular-nums text-[#BBBBBB]">{Math.round(file.progress ?? 0)} %</p>
              </div>
            )}
            {status === "error" && <p role="alert" className="max-w-[48ch] text-[13.5px] text-[#ff7b7b]">{file.error ?? "No se pudo subir el archivo."}</p>}
            <div className="relative z-[2] flex flex-wrap justify-center gap-3">
              {status !== "uploading" && (
                <label htmlFor={id} className={`${BUTTON_SECONDARY} cursor-pointer`}>
                  {status === "error" ? "Probar con otro archivo" : "Cambiar"}
                </label>
              )}
              <button type="button" onClick={() => files.remove(slot)} aria-label={`${status === "uploading" ? "Cancelar" : status === "error" ? "Descartar" : "Quitar"} ${label}`} className={BUTTON_SECONDARY}>
                {status === "uploading" ? "Cancelar" : status === "error" ? "Descartar" : "Quitar"}
              </button>
            </div>
          </>
        )}
      </HaloSurface>
      </div>
      {required && showErrors && !file && <p role="alert" className="text-[13px] text-[#ff7b7b]">Falta el {noun}.</p>}
    </div>
  );
}
