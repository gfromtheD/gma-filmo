"use client";

import { create } from "zustand";

interface SearchQueryStore {
  /** Lo que se escribió en el buscador; se conserva al salir de la página y volver. */
  readonly query: string;
  readonly setQuery: (query: string) => void;
}

export const useSearchQueryStore = create<SearchQueryStore>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
}));
