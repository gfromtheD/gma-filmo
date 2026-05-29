"use client";

import { create } from "zustand";

import type { CatalogFilters } from "@/types/filters";

const DEFAULT_FILTERS: CatalogFilters = {
  query: "",
  mediaType: "all",
  genre: null,
  maturityRating: null,
};

interface FilterStore {
  readonly filters: CatalogFilters;
  readonly updateFilters: (filters: Partial<CatalogFilters>) => void;
  readonly clearFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: DEFAULT_FILTERS,
  updateFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
}));
