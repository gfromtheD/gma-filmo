"use client";

import { create } from "zustand";

function pickGreeting(isFirstVisit: boolean): string {
  if (isFirstVisit) return "Bienvenido,";
  const hour = new Date().getHours();
  const morning   = ["Buenos días,", "Hola,", "Hola de nuevo,"];
  const afternoon = ["Buenas tardes,", "Hola,", "Hola de nuevo,"];
  const night     = ["Buenas noches,", "Hola,", "Hola de nuevo,"];
  const pool =
    hour >= 5 && hour < 12 ? morning :
    hour >= 12 && hour < 19 ? afternoon :
    night;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

interface TransitionStore {
  phase: "idle" | "expanding" | "contracting";
  origin: { x: number; y: number };
  size: number;
  chipPos: { x: number; y: number };
  profileName: string;
  greeting: string;
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
  greeting: "",
  startExpand: (origin, size, profileName, isFirstVisit) =>
    set({ phase: "expanding", origin, size, profileName, greeting: pickGreeting(isFirstVisit) }),
  startContract: () => set({ phase: "contracting" }),
  setChipPos: (chipPos) => set({ chipPos }),
  reset: () => set({ phase: "idle" }),
}));
