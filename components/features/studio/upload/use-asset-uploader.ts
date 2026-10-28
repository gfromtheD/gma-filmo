"use client";

import { useCallback, useRef, useState } from "react";
import type { AssetRequest, UploadEngine } from "@/lib/studio/engine";
import {
  IMAGE_SNIFF_BYTES, imageContentProblem, imageSizeAdvice, sniffImageType, validateFile, type PixelSize,
} from "@/lib/studio/file-rules";
import { readImageSize } from "@/lib/studio/image-size";
import { readVideoSeconds } from "@/lib/studio/processing-estimate";
import type { UploadedAsset, UploadPhase } from "@/lib/studio/upload-draft";
import { uploadControllers } from "./shared-uploads";

type SetAsset = (slot: string, asset: UploadedAsset | null) => void;

/**
 * Sube archivos a través del motor y mantiene el borrador al día: el hueco pasa por «subiendo» (con porcentaje) y acaba
 * en «hecho» o «error». Permite cancelar y quitar, y calcula el consejo de tamaño de las imágenes.
 */
export function useAssetUploader(engine: UploadEngine, setAsset: SetAsset) {
  // Compartidas con toda la pestaña: salir de la pantalla (o de Mi Estudio) no corta las subidas en curso.
  const controllers = useRef(uploadControllers);
  const [advice, setAdvice] = useState<Record<string, string | null>>({});

  const upload = useCallback(
    async (request: AssetRequest, suggested?: PixelSize) => {
      const { slot, file } = request;
      controllers.current.get(slot)?.abort();
      const reject = (reason: string) => {
        const wanted = suggested && !reason.includes("Medida esperada") ? ` Medida esperada: ${suggested.width} × ${suggested.height} px.` : "";
        setAdvice((a) => ({ ...a, [slot]: null }));
        setAsset(slot, { name: file.name, sizeBytes: file.size, url: null, status: "error", error: `${reason}${wanted}` });
      };
      const problem = validateFile(request.rule, file);
      if (problem) return reject(problem);
      if (request.rule === "image") {
        // Antes de subir: formato real (por el contenido) y medidas; si no valen, no se sube nada.
        const header = new Uint8Array(await file.slice(0, IMAGE_SNIFF_BYTES).arrayBuffer());
        const size = await readImageSize(file);
        const contentProblem = imageContentProblem(sniffImageType(header), size, suggested);
        if (contentProblem) return reject(contentProblem);
        if (suggested) setAdvice((a) => ({ ...a, [slot]: size ? imageSizeAdvice(size, suggested) : null }));
      }
      const controller = new AbortController();
      controllers.current.set(slot, controller);
      // Las imágenes se ven al instante desde el propio archivo; la del servidor llega al terminar sin que cambie nada.
      const previewUrl = request.rule === "image" ? URL.createObjectURL(file) : undefined;
      // La duración del vídeo sirve luego para estimar cuánto falta de conversión en el servidor.
      const mediaSeconds = request.rule === "video" ? await readVideoSeconds(file) : undefined;
      const base = { name: file.name, sizeBytes: file.size, url: null, ...(previewUrl ? { previewUrl } : {}), ...(mediaSeconds ? { mediaSeconds } : {}) } as const;
      let phase: UploadPhase = "uploading";
      setAsset(slot, { ...base, status: "uploading", phase, progress: 0 });
      try {
        const result = await engine.uploadAsset(
          request,
          // Al acabar, el cliente avisa con un 100 % que ya no pinta nada: la etapa de procesado manda.
          (percent) => { if (phase !== "processing") setAsset(slot, { ...base, status: "uploading", phase: "uploading", progress: percent }); },
          controller.signal,
          () => { phase = "processing"; setAsset(slot, { ...base, status: "processing", phase: "processing" }); },
          (next, percent) => {
            phase = next;
            setAsset(slot, next === "processing" ? { ...base, status: "processing", phase: next } : { ...base, status: "uploading", phase: next, progress: percent ?? 0 });
          },
        );
        if (!controller.signal.aborted) setAsset(slot, previewUrl ? { ...result, previewUrl } : result);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setAsset(slot, { name: file.name, sizeBytes: file.size, url: null, status: "error", error: "No se pudo subir el archivo." });
        }
      } finally {
        if (controllers.current.get(slot) === controller) controllers.current.delete(slot);
      }
    },
    [engine, setAsset],
  );

  const remove = useCallback(
    (slot: string) => {
      controllers.current.get(slot)?.abort();
      controllers.current.delete(slot);
      // Abortar solo detiene el navegador: con el motor multimedia, quitar un archivo también cancela su sesión en el
      // servidor para liberar la cuota reservada.
      const cancel = (engine as { cancelAsset?: (slot: string) => Promise<void> }).cancelAsset;
      if (cancel) void cancel.call(engine, slot).catch(() => undefined);
      setAdvice((a) => ({ ...a, [slot]: null }));
      setAsset(slot, null);
    },
    [engine, setAsset],
  );

  /**
   * Tras recargar: un archivo que ya se envió y el servidor seguía convirtiendo se vuelve a vigilar hasta que acaba. Si el
   * motor no sabe hacerlo o el servidor ya no lo tiene, se pide volver a subirlo (como antes).
   */
  const resume = useCallback(
    async (slot: string, asset: UploadedAsset) => {
      const lost: UploadedAsset = { ...asset, url: null, status: "error", progress: undefined, error: "Vuelve a subir este archivo." };
      if (!engine.resumeProcessing) return setAsset(slot, lost);
      const controller = new AbortController();
      controllers.current.set(slot, controller);
      try {
        const result = await engine.resumeProcessing(slot, controller.signal);
        if (!controller.signal.aborted) setAsset(slot, result ?? lost);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") setAsset(slot, lost);
      } finally {
        if (controllers.current.get(slot) === controller) controllers.current.delete(slot);
      }
    },
    [engine, setAsset],
  );

  return { upload, remove, resume, advice };
}
