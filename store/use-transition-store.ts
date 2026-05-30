"use client";

import { create } from "zustand";

interface TransitionStore {
  phase: "idle" | "expanding" | "contracting";
  origin: { x: number; y: number };
  size: number;
  chipPos: { x: number; y: number };
  profileName: string;
  isFirstVisit: boolean;
  startExpand: (origin: { x: number; y: number }, size: number, profileName: string, isFirstVisit: boolean) => void;
  startContract: () => void;
  setChipPos: (pos: { x: number; y: number }) => void;
  reset: () => void;
}

export const useTransitionStore = create<TransitionStore>((set) => ({
  phase: "idle",
  origin: { x: 0, y: 0 },
  size: 3000,
  chipPos: { x: 0, y: 40 },
  profileName: "",
  isFirstVisit: false,
  startExpand: (origin, size, profileName, isFirstVisit) =>
    set({ phase: "expanding", origin, size, profileName, isFirstVisit }),
  startContract: () => set({ phase: "contracting" }),
  setChipPos: (chipPos) => set({ chipPos }),
  reset: () => set({ phase: "idle" }),
}));
