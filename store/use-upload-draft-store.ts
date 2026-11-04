"use client";

import { create } from "zustand";
import { clearDraft, DRAFT_STORAGE_KEY, loadDraft, saveDraft } from "@/lib/studio/draft-storage";
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
  /** Cuenta dueña del borrador cargado (cada cuenta tiene el suyo en `localStorage`). */
  ownerId: string | null;
  /** Último guardado en `localStorage` (ms). */
  savedAt: number | null;
  /** Lee el borrador guardado de esa cuenta; solo una vez por cuenta en la vida de la pestaña. */
  load: (userId: string) => void;
  setDraft: (next: UploadDraft | ((current: UploadDraft) => UploadDraft)) => void;
  /** Vacía el borrador (y lo guardado) para empezar otra obra. */
  reset: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSave = 0;

export const useUploadDraftStore = create<UploadDraftStore>()((set, get) => {
  const saveNow = () => {
    saveTimer = null;
    saveDraft(window.localStorage, get().draft, get().ownerId);
    lastSave = Date.now();
    set({ savedAt: lastSave });
  };
  const scheduleSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(saveNow, Math.max(0, SAVE_DELAY_MS - (Date.now() - lastSave)));
  };
  // Al recargar o cerrar la pestaña con un guardado pendiente, se guarda ya: si no, se perdería lo último que se escribió.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveNow();
    });
  }
  return {
    draft: emptyDraft(),
    isReady: false,
    ownerId: null,
    savedAt: null,
    load: (userId) => {
      if (get().isReady && get().ownerId === userId) return;
      // Otra cuenta en la misma pestaña: se descarta lo pendiente de guardar de la anterior para no mezclar borradores.
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      // El borrador de antes de separar por cuenta tenía una clave común: no se sabe de quién era, se borra.
      try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* sin almacenamiento */ }
      set({ draft: loadDraft(window.localStorage, userId), ownerId: userId, isReady: true });
    },
    setDraft: (next) => {
      set((state) => ({ draft: typeof next === "function" ? next(state.draft) : next }));
      if (get().isReady) scheduleSave();
    },
    reset: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      clearDraft(window.localStorage, get().ownerId);
      set({ draft: emptyDraft() });
    },
  };
});
