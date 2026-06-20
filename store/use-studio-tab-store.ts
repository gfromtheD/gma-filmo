"use client";

import { create } from "zustand";
import type { StudioTabId } from "@/components/features/studio/studio-types";

interface StudioTabStore {
  activeTab: StudioTabId;
  setActiveTab: (tab: StudioTabId) => void;
}

export const useStudioTabStore = create<StudioTabStore>()((set) => ({
  activeTab: "inicio",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
