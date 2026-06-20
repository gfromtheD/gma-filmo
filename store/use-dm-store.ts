"use client";

import { create } from "zustand";

interface DMStore {
  isOpen:        boolean;
  activeConvoId: string | null;
  open:          (convoId?: string) => void;
  close:         () => void;
  setConvo:      (id: string | null) => void;
}

export const useDMStore = create<DMStore>()((set) => ({
  isOpen:        false,
  activeConvoId: null,
  open:  (convoId) => set({ isOpen: true,  activeConvoId: convoId ?? null }),
  close: ()        => set({ isOpen: false, activeConvoId: null }),
  setConvo: (id)   => set({ activeConvoId: id }),
}));
