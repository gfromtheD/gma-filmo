"use client";

import { create } from "zustand";

import type { SessionState, SessionUser } from "@/types/session";

interface SessionStore extends SessionState {
  readonly setLoading: () => void;
  readonly setUser: (user: SessionUser) => void;
  readonly clearSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  status: "anonymous",
  user: null,
  setLoading: () => set({ status: "loading" }),
  setUser: (user) => set({ status: "authenticated", user }),
  clearSession: () => set({ status: "anonymous", user: null }),
}));
