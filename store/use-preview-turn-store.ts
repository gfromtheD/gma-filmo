"use client";

import { create } from "zustand";

/**
 * Turno de las vistas previas: un solo vídeo de portada suena y avanza a la vez. Quien abre una vista previa encima del
 * hero (la tarjeta flotante) pide el turno y el hero se pausa —sin cambiar de diapositiva ni perder su sonido— hasta que
 * se devuelve. Manda el último gesto del usuario.
 */
interface PreviewTurnStore {
  /** Quién tiene ahora el turno (un id cualquiera); `null` si nadie: entonces lo tiene el hero. */
  holder: string | null;
  claim: (id: string) => void;
  /** Solo lo devuelve quien lo tiene (si otro lo pidió después, no se lo quita). */
  release: (id: string) => void;
}

export const usePreviewTurnStore = create<PreviewTurnStore>()((set) => ({
  holder: null,
  claim: (id) => set({ holder: id }),
  release: (id) => set((state) => (state.holder === id ? { holder: null } : state)),
}));
