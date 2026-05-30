# Welcome Message Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded "Hola de nuevo," greeting in the profile transition overlay with a dynamic greeting that varies by first visit, time of day, and random selection — always followed by the profile name.

**Architecture:** Three-file change. The store gains an `isFirstVisit` flag. The profile selector writes to localStorage and passes the flag to the store before triggering the transition. The overlay reads the flag and picks a greeting at render time.

**Tech Stack:** Next.js 14, Zustand, Framer Motion, localStorage

---

### Task 1: Add `isFirstVisit` to the transition store

**Files:**
- Modify: `store/use-transition-store.ts`

- [ ] **Step 1: Update the store**

Replace the entire file content with:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd streaming-app && npx tsc --noEmit
```

Expected: no errors related to `use-transition-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add store/use-transition-store.ts
git commit -m "feat: add isFirstVisit flag to transition store"
```

---

### Task 2: Write localStorage logic and pass `isFirstVisit` from the profile selector

**Files:**
- Modify: `components/features/profiles/profile-selector.tsx`

- [ ] **Step 1: Update `triggerNav` to accept `profileId` and handle localStorage**

Find the `triggerNav` function (currently around line 178) and replace it:

```ts
function triggerNav(rect: DOMRect, navigate: () => void, name: string, profileId: string) {
  const key = `gma_profile_visited_${profileId}`;
  const isFirstVisit = !localStorage.getItem(key);
  if (isFirstVisit) localStorage.setItem(key, "1");
  const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.6;
  startExpand({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, size, name, isFirstVisit);
  setTimeout(navigate, 1600);
}
```

- [ ] **Step 2: Pass `profileId` to `triggerNav` at the Supabase profile call site**

Find the `onClick` of the primary Supabase `ProfileCard` (around line 216) and update it:

```tsx
onClick={(rect) => triggerNav(rect, onSelectSupabase, supabaseName ?? "", "__supabase__")}
```

- [ ] **Step 3: Pass `profileId` to `triggerNav` at the sub-profile call site**

Find the `onClick` inside the `profiles.map(...)` block (around line 244) and update it:

```tsx
onClick={(rect) =>
  profile.requirePin && profile.pin
    ? onSelectSub(profile, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    : triggerNav(rect, () => onSelectSub(profile, { x: 0, y: 0 }), profile.name, profile.id)
}
```

- [ ] **Step 4: Add localStorage logic to the PIN gate `onSuccess` callback**

Find `pinGate.onSuccess` (around line 117) and update it:

```tsx
onSuccess={() => {
  const key = `gma_profile_visited_${pinGate.id}`;
  const isFirstVisit = !localStorage.getItem(key);
  if (isFirstVisit) localStorage.setItem(key, "1");
  setActiveProfile({ id: pinGate.id, name: pinGate.name, isKids: pinGate.isKids });
  const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.6;
  startExpand(pinGate.origin, size, pinGate.name, isFirstVisit);
  setTimeout(() => router.push("/inicio"), 1600);
}}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/features/profiles/profile-selector.tsx
git commit -m "feat: detect first visit per profile and pass flag to transition store"
```

---

### Task 3: Dynamic greeting in the overlay

**Files:**
- Modify: `components/ui/profile-transition-overlay.tsx`

- [ ] **Step 1: Add `isFirstVisit` from the store and a `getGreeting` helper**

Add `isFirstVisit` to the destructured store values (after `profileName`):

```ts
const isFirstVisit = useTransitionStore((s) => s.isFirstVisit);
```

Add this function outside the component (above `ProfileTransitionOverlay`):

```ts
function getGreeting(isFirstVisit: boolean): string {
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
```

- [ ] **Step 2: Replace the hardcoded text with dynamic greeting**

Find the welcome text block inside `<AnimatePresence>` and replace the two `<span>` elements:

```tsx
{profileName ? (
  <>
    <span style={{
      color: "rgba(3,26,14,0.5)",
      fontSize: 26,
      fontWeight: 600,
      letterSpacing: "0.01em",
    }}>
      {getGreeting(isFirstVisit)}
    </span>
    <span style={{
      color: "#031A0E",
      fontSize: 120,
      fontFamily: "var(--font-serif), 'Instrument Serif', Georgia, serif",
      fontStyle: "italic",
      lineHeight: 1.0,
      fontWeight: 400,
    }}>
      {profileName}
    </span>
  </>
) : (
  <span style={{
    color: "#031A0E",
    fontSize: 40,
    fontWeight: 600,
    letterSpacing: "0.01em",
  }}>
    Bienvenido a GMA Filmo
  </span>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test — returning user**

1. Abrir la app en el navegador (`npm run dev`)
2. Ir a `/perfiles`
3. Pulsar en un perfil → verificar que aparece la animación verde con saludo + nombre
4. Volver a `/perfiles` y pulsar el mismo perfil de nuevo → verificar que el saludo es distinto al de primera vez (no dice "Bienvenido,")
5. Repetir varias veces para comprobar variedad (pueden coincidir por azar)

- [ ] **Step 5: Manual test — first visit**

1. Abrir DevTools → Application → Local Storage → borrar las claves `gma_profile_visited_*`
2. Pulsar un perfil → verificar que dice "Bienvenido," + nombre
3. Volver a perfiles y entrar de nuevo → verificar que ya no dice "Bienvenido,"

- [ ] **Step 6: Commit**

```bash
git add components/ui/profile-transition-overlay.tsx
git commit -m "feat: dynamic welcome greeting by first visit and time of day"
```
