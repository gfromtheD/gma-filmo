"use client";

import { create } from "zustand";
import { clearDraft, loadDraft, saveDraft } from "@/lib/studio/draft-storage";
import { emptyDraft, type UploadDraft } from "@/lib/studio/upload-draft";

/** Como mucho un guardado en `localStorage` cada medio segundo, también mientras una subida cambia el borrador sin parar. */
const SAVE_DELAY_MS = 500;

/**
 * Borrador de la pasarela de subida, vivo mientras la pestaña esté abierta. No pertenece a la pantalla de Subir: si el
 * usuario se va a otra sección de la web, la pantalla se desmonta pero las subidas en curso siguen escribiendo aquí, y al
 * volver la pasarela lo encuentra todo como estaba. Se guarda solo en `localStorage` (para sobrevivir a una recarga).
 */
interface UploadDraftStore {
  draft: UploadDraft;
  /** Ya se leyó de `localStorage` (en el servidor no existe). */
  isReady: boolean;
  /** Último guardado en `localStorage` (ms). */
  savedAt: number | null;
  /** Lee el borrador guardado; solo la primera vez en la vida de la pestaña. */
  load: () => void;
  setDraft: (next: UploadDraft | ((current: UploadDraft) => UploadDraft)) => void;
  /** Vacía el borrador (y lo guardado) para empezar otra obra. */
  reset: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSave = 0;

export const useUploadDraftStore = create<UploadDraftStore>()((set, get) => {
  const scheduleSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveDraft(window.localStorage, get().draft);
      lastSave = Date.now();
      set({ savedAt: lastSave });
    }, Math.max(0, SAVE_DELAY_MS - (Date.now() - lastSave)));
  };
  return {
    draft: emptyDraft(),
    isReady: false,
    savedAt: null,
    load: () => {
      if (get().isReady) return;
      set({ draft: loadDraft(window.localStorage), isReady: true });
    },
    setDraft: (next) => {
      set((state) => ({ draft: typeof next === "function" ? next(state.draft) : next }));
      if (get().isReady) scheduleSave();
    },
    reset: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      clearDraft(window.localStorage);
      set({ draft: emptyDraft() });
    },
  };
});
