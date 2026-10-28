"use client";

import { getUploadEngine, type UploadEngine } from "@/lib/studio/engine";
import { useUploadDraftStore } from "@/store/use-upload-draft-store";

/**
 * Lo que la pasarela comparte con el resto de la pestaña para que una subida no dependa de que la pantalla de Subir siga
 * montada: el motor (lee el borrador del almacén), las subidas en curso (para poder cancelarlas al quitar un archivo) y si
 * ya se volvieron a vigilar las conversiones pendientes tras cargar la página.
 */
let engine: UploadEngine | null = null;

export function sharedUploadEngine(): UploadEngine {
  engine ??= getUploadEngine(() => useUploadDraftStore.getState().draft);
  return engine;
}

/** Subidas en curso por hueco. No se abortan al desmontar la pantalla: solo al quitar o cambiar ese archivo. */
export const uploadControllers = new Map<string, AbortController>();

/** Las conversiones que seguían en el servidor al cargar la página se vuelven a vigilar una sola vez por pestaña. */
export const processingResume = { done: false };
