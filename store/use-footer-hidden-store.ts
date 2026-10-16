"use client";

import { create } from "zustand";

interface FooterHiddenStore {
  /** Una pantalla puede pedir que el pie no aparezca (por ejemplo, mientras se rellena la pasarela de subida). */
  isHidden: boolean;
  setHidden: (isHidden: boolean) => void;
}

export const useFooterHiddenStore = create<FooterHiddenStore>()((set) => ({
  isHidden: false,
  setHidden: (isHidden) => set({ isHidden }),
}));
