# Welcome Message Variants — Design Spec
Date: 2026-05-30

## Goal

Replace the hardcoded "Hola de nuevo, [name]" in the profile transition overlay with a dynamic greeting that varies by:
- Whether the profile is entering for the first time
- Time of day (morning / afternoon / night)
- Random selection within each time slot

The name always appears as the large element below the greeting. The greeting is always short, natural, and welcoming — never motivational.

---

## Structure (unchanged visually)

```
[small greeting text],    ← varies
[BIG profile name]        ← always the profile name
```

Edge case: if the profile has no name, show only "Bienvenido a GMA Filmo" centered, with no large name below.

---

## Message Pool

| Situation | Greeting options |
|---|---|
| First visit ever | "Bienvenido," |
| Morning (05:00–11:59) | "Buenos días," · "Hola," · "Hola de nuevo," |
| Afternoon (12:00–18:59) | "Buenas tardes," · "Hola," · "Hola de nuevo," |
| Night (19:00–04:59) | "Buenas noches," · "Hola," · "Hola de nuevo," |

Selection within a slot: `Math.random()` at the moment the overlay renders.

---

## First-visit detection

- **Scope**: per profile (each profile tracked independently)
- **Storage**: `localStorage`, key `gma_profile_visited_<profileId>`
- **Write**: at the moment `startExpand` is called, before calling it
- **Read**: absence of the key → `isFirstVisit = true`; presence → `false`
- Profile IDs used: `"__supabase__"` for the primary account profile, UUID for sub-profiles

---

## Changes required

### 1. `store/use-transition-store.ts`
- Add `isFirstVisit: boolean` to state (default `false`)
- Update `startExpand` signature: `(origin, size, profileName, isFirstVisit) => void`

### 2. `components/features/profiles/profile-selector.tsx`
- Two call sites for `startExpand`: direct select and post-PIN success
- Before each call:
  ```ts
  const key = `gma_profile_visited_${profileId}`;
  const isFirstVisit = !localStorage.getItem(key);
  if (isFirstVisit) localStorage.setItem(key, "1");
  startExpand(origin, size, profileName, isFirstVisit);
  ```

### 3. `components/ui/profile-transition-overlay.tsx`
- Add `isFirstVisit` from the store
- Replace hardcoded `"Hola de nuevo,"` with a `getGreeting(isFirstVisit)` function:
  - Returns `"Bienvenido,"` if first visit
  - Otherwise picks randomly from the time-of-day pool
- Handle no-name edge case: if `profileName` is empty, render a single centered `"Bienvenido a GMA Filmo"` instead of the two-element layout

---

## Out of scope

- Server-side tracking of visits (localStorage is sufficient)
- Gendered greetings ("Bienvenida" vs "Bienvenido") — not enough data to determine gender
- Animating the greeting text differently per variant
