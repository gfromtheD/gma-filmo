"use client";

import { create } from "zustand";

function pickGreeting(isFirstVisit: boolean): string {
  if (isFirstVisit) return "Bienvenido,";
  const hour = new Date().getHours();
  const morning   = ["Buenos días,", "Hola,", "Hola de nuevo,"];
  const afternoon = ["Buenas tardes,", "Hola,", "Hola de nuevo,"];
  const night     = ["Buenas noches,", "Noche de cine,", "Hola de nuevo,"];
  const pool =
    hour >= 5 && hour < 12 ? morning :
    hour >= 12 && hour < 19 ? afternoon :
    night;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// "viewer" = verde de siempre (selector de perfiles). "creator" = invertido
// (negro que se expande, texto verde) — solo para el onboarding de creador.
export type TransitionVariant = "viewer" | "creator";

interface TransitionStore {
  phase: "idle" | "expanding" | "contracting";
  origin: { x: number; y: number };
  size: number;
  chipPos: { x: number; y: number };
  profileName: string;
  greeting: string;
  variant: TransitionVariant;
  // Ruta desde la que se llamó a startExpand — el overlay espera a que el
  // pathname cambie respecto a esta para saber que la navegación ya ocurrió,
  // en vez de asumir que siempre se lanza desde "/perfiles".
  startPath: string;
  startExpand: (
    origin: { x: number; y: number },
    size: number,
    profileName: string,
    isFirstVisit: boolean,
    variant?: TransitionVariant,
  ) => void;
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
  variant: "viewer",
  startPath: "",
  startExpand: (origin, size, profileName, isFirstVisit, variant = "viewer") =>
    set({
      phase: "expanding",
      origin,
      size,
      profileName,
      variant,
      greeting: pickGreeting(isFirstVisit),
      startPath: typeof window !== "undefined" ? window.location.pathname : "",
    }),
  startContract: () => set({ phase: "contracting" }),
  setChipPos: (chipPos) => set({ chipPos }),
  reset: () => set({ phase: "idle" }),
}));
