"use client";

import { useFilterStore } from "@/store/use-filter-store";

export function useCatalogFilters() {
  const filters       = useFilterStore((s) => s.filters);
  const updateFilters = useFilterStore((s) => s.updateFilters);
  const clearFilters  = useFilterStore((s) => s.clearFilters);
  return { filters, updateFilters, clearFilters };
}
