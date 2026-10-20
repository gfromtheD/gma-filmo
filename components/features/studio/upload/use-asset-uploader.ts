"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetRequest, UploadEngine } from "@/lib/studio/engine";
import {
  IMAGE_SNIFF_BYTES, imageContentProblem, imageSizeAdvice, sniffImageType, validateFile, type PixelSize,
} from "@/lib/studio/file-rules";
import type { UploadedAsset } from "@/lib/studio/upload-draft";

type SetAsset = (slot: string, asset: UploadedAsset | null) => void;

/** Mide una imagen en el navegador (para dar un consejo de tamaño); `null` si no se puede leer. */
async function readImageSize(file: File): Promise<PixelSize | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * Sube archivos a través del motor y mantiene el borrador al día: el hueco pasa por «subiendo» (con porcentaje) y acaba
 * en «hecho» o «error». Permite cancelar y quitar, y calcula el consejo de tamaño de las imágenes.
 */
export function useAssetUploader(engine: UploadEngine, setAsset: SetAsset) {
  const controllers = useRef(new Map<string, AbortController>());
  const [advice, setAdvice] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((c) => c.abort());
  }, []);

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
      setAsset(slot, { name: file.name, sizeBytes: file.size, url: null, status: "uploading", progress: 0 });
      try {
        const result = await engine.uploadAsset(
          request,
          (percent) => setAsset(slot, { name: file.name, sizeBytes: file.size, url: null, status: "uploading", progress: percent }),
          controller.signal,
          () => setAsset(slot, { name: file.name, sizeBytes: file.size, url: null, status: "processing" }),
        );
        if (!controller.signal.aborted) setAsset(slot, result);
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

  return { upload, remove, advice };
}
