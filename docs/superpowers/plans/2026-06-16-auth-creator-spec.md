# Auth & Creator Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Let guests read comments on a film/short detail page while keeping the comment input gated behind login; (2) let creators set `studio_name`/`location`/`website_url`/bio on signup and edit them later from the real "Mi Estudio" profile tab instead of a mock form; (3) force new Google-OAuth creator signups through the profile-completion step before they can reach `/mi-estudio`; (4) seed the existing `/creadores/[slug]` content-creator directory (the `artistas` table) with real data for the 80 creators — this is a **different system** from `creator_profiles` (see Resolved Contradictions below).

**Architecture:** Next.js 14 App Router, Supabase Auth + Postgres via `@supabase/ssr`/`@supabase/supabase-js` directly (no ORM). No new abstractions — extend existing files/patterns (`GuestGate`, `creator_profiles` table, `auth/callback/route.ts`, `studio-profile-view.tsx`, root-level `.mjs` seed scripts).

**Tech Stack:** Next.js 14.2.35, TypeScript 5, Supabase, Tailwind 4, Zustand (unused here), no new deps.

---

## Resolved Contradictions (read before starting any task)

These were found by auditing the real code against the original spec and confirmed with the user — they override anything that conflicts in the spec text:

1. **No global login modal exists.** `GuestGate` (`components/ui/guest-gate.tsx`) redirects to `/` via `router.push("/")`. Task 1 reuses this pattern — no new modal/provider is built.
2. **`creator_profiles` real columns are `user_id, creator_name, bio, status, created_at`** (`types/database.ts:17-24`). There is no `studio_name`/`website_url`/`location`. `bio` already exists — it becomes the "studio_description" field (300-char cap), not a new column. `status` is out of scope (unused anywhere in the codebase today).
3. **The "Mi Estudio" profile editor (`studio-profile-view.tsx`) is 100% mock** — "Guardar cambios" only shows a toast, no Supabase call. Task 2 wires it to real data for the fields that have a DB home (`studioName`→`studio_name`, `artistName`→`creator_name`, `bio`→`bio`, `location`→`location`, `socials.web`→`website_url`). `role`, `instagram`, `vimeo` have no backing column in this spec's scope and stay local-only (unsaved) — not a regression, they were already unsaved before this change.
4. **The profile-completeness gate (Task 3) only applies to the Google-OAuth "creator pending" path** (`gma_creator_pending` cookie in `app/auth/callback/route.ts`). It does **not** touch `mi-estudio/layout.tsx`'s existing "row exists" check, so creators who signed up via email or via the viewer→creator upgrade path (who never had `studio_name` collected) are not retroactively locked out.
5. **Task 4 is redefined.** The 80-creator directory at `/creadores/[slug]` reads from `creator_public_profiles` (`lib/supabase/queries.ts:410`), which is **not** `creator_profiles` and **not** generated in `types/database.ts` — it was created by hand in the Supabase dashboard and isn't in any migration file in this repo. The seed script targets the one table we can verify from code: `artistas` (`types/database.ts:41-50`: `id, name, slug, bio, r2_photo_url, created_at`). Whether `creator_public_profiles` is a plain view over `artistas` (nothing further to do) or a separate table holding the extra fields (`nacionalidad`, `imagen_portada`, `donacion_*`, `redes_sociales`, `titulos`) is **unverified** — flagged as an open item at the end of Task 4, not guessed at.

---

## Task 1: Guest comments — visible read, gated input

**Files:**
- Modify: `components/features/ratings/ratings-block.tsx:1-44`
- Create: `components/features/ratings/login-prompt-input.tsx`
- Test: manual (see Step 5 — no test runner is configured for component behavior in this repo; Playwright is present but no existing ratings e2e spec to extend safely without auditing further, so this task is verified manually per the "Criterio de aceptación" below)

### Step 1: Read the current guest-blocking logic (already done — recap)

`ratings-block.tsx:43` wraps the **entire** ratings section (score, review list, and the "Valorar" button that opens `RatingModal`) in `<GuestGate>`, which blurs everything and shows a single "Iniciar sesión o registrarse" CTA. This is the only place that needs to change.

`GET /api/ratings/community` (`app/api/ratings/community/route.ts`) already reads via the service-role client and returns reviews with no auth requirement — no backend/RLS change is needed (see Resolved Contradiction #1's sibling finding: the public-read migration the original spec proposed is unnecessary and is intentionally **not** created).

### Step 2: Create the login-prompt component

```tsx
// components/features/ratings/login-prompt-input.tsx
"use client";

import { useRouter } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";

export function LoginPromptInput() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      className="flex w-full items-center gap-3 rounded-[12px] border border-[#262626] bg-[#0D0D0D] px-5 py-4 text-left text-[14px] text-[#6D7D94] transition-colors hover:border-[#3A3A3A]"
    >
      <GmaIcon name="star" size={16} strokeWidth={2} className="shrink-0 text-[#4A5568]" />
      Inicia sesión para comentar
    </button>
  );
}
```

`GmaIcon` and the color tokens match the existing style in `ratings-block.tsx` (same `#0D0D0D`/`#262626`/`#6D7D94` palette used throughout that file) — no new design system introduced.

### Step 3: Split guest vs. logged-in rendering in `RatingsBlock`

Replace the current wrap-everything block. Current code (`ratings-block.tsx:1-44, 119-136`):

```tsx
import { GuestGate } from "@/components/ui/guest-gate";
...
  return (
    <GuestGate message="Para valorar este corto y ver tus puntuaciones, inicia sesión o regístrate.">
      <section ref={sectionRef}>
        ...
      </section>

      {modalOpen && (
        <RatingModal ... />
      )}
    </GuestGate>
  );
```

New code — remove the `GuestGate` import/wrap, add `useIsGuest` and the new component, and only gate the score row's CTA button + the modal:

```tsx
import { useIsGuest } from "@/hooks/use-is-guest";
import { LoginPromptInput } from "./login-prompt-input";
// remove: import { GuestGate } from "@/components/ui/guest-gate";
```

Inside `RatingsBlock`, add right after `const currentUserId = useSupabaseUserId();`:

```tsx
  const isGuest = useIsGuest();
```

Replace the score-row CTA button (currently always `<button onClick={() => setModalOpen(true)}>...Valorar/Editar nota</button>`, lines 86-93) with a conditional:

```tsx
          {isGuest ? (
            <LoginPromptInput />
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A]"
            >
              <GmaIcon name="star" size={14} strokeWidth={2} />
              {savedScore !== null ? "Editar nota" : "Valorar"}
            </button>
          )}
```

Remove the outer `<GuestGate>...</GuestGate>` wrapper entirely (keep the `<section>` and the `{modalOpen && <RatingModal .../>}` block as direct children of the component's return, not wrapped). Since `isGuest` users never set `modalOpen` to `true` (the button that does that is now hidden for them), the modal naturally never renders for guests — no extra guard needed there.

The reviews list (`reviews.map(...)`) and the score/vote display already render unconditionally for everyone — that part needs **no code change**, it was already guest-visible in markup; it was only invisible because `GuestGate` blurred/covered the whole section.

### Step 4: Verify no other usage of `GuestGate` breaks

```bash
grep -rn "GuestGate" components/ app/ --include="*.tsx"
```
Expected: only `components/ui/guest-gate.tsx` (definition) remains as a match if no other feature uses it. If other matches appear (besides the definition file), read them before assuming they're unaffected — this task only removes the import from `ratings-block.tsx`, the `GuestGate` component itself is not deleted.

### Step 5: Manual verification

```bash
npm run dev
```
1. In a browser, set the guest cookie: open devtools console on `localhost:3000` and run `document.cookie = "gma_guest=1; path=/"`, then navigate to any `/cortos/[id]` or `/peliculas/[id]` detail page with existing reviews.
2. Confirm: review list and average score are visible, not blurred.
3. Confirm: in place of "Valorar", a row reading "Inicia sesión para comentar" appears.
4. Click it — confirm it navigates to `/` (no modal, by the chosen design decision).
5. Clear the guest cookie, log in normally, revisit the same page — confirm "Valorar"/"Editar nota" still works exactly as before (modal opens, submit still calls `setRating`).

### Step 6: Commit

```bash
git add components/features/ratings/ratings-block.tsx components/features/ratings/login-prompt-input.tsx
git commit -m "feat(ratings): show comments to guests, gate only the input"
```

---

## Task 2: Creator profile fields — signup form + real Mi Estudio editing

### Task 2a — Migration

**Files:**
- Create: `supabase/migrations/20260616_extend_creator_profiles.sql`

Existing migrations in this repo use `YYYYMMDD_description.sql` (date only, no time component — e.g. `20260529_review_likes_and_proposals.sql`). Following that convention, not the spec's `YYYYMMDDHHMMSS` format.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260616_extend_creator_profiles.sql
-- Adds studio_name (required going forward at signup), location, and website_url.
-- bio already exists and becomes the "studio description" field — capped at 300 chars.
-- NOT VALID + no VALIDATE step: avoids failing the migration if any existing row's
-- bio is already longer than 300 chars; new/updated rows are still checked going forward
-- once validated manually if needed.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS studio_name TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE public.creator_profiles
  ADD CONSTRAINT IF NOT EXISTS creator_profiles_bio_max_300
  CHECK (bio IS NULL OR char_length(bio) <= 300) NOT VALID;
```

- [ ] **Step 2: Apply locally / push to Supabase**

```bash
npx supabase db push
```
Expected: migration applies cleanly (no rows currently violate the constraint since `bio` has never been editable from a real form before this point — Task 2c/2d are what start writing to it).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260616_extend_creator_profiles.sql
git commit -m "feat(db): add studio_name, location, website_url to creator_profiles"
```

### Task 2b — Types

**Files:**
- Modify: `types/database.ts:17-40` (the `creator_profiles` table entry — **not** `types/creator.ts`, which models the unrelated `artistas`/`creator_public_profiles` content-creator directory, see Resolved Contradiction #5)

- [ ] **Step 1: Update the `creator_profiles` block**

Current (`types/database.ts:17-40`):

```ts
      creator_profiles: {
        Row: {
          user_id: string
          creator_name: string
          bio: string | null
          status: string
          created_at: string
        }
        Insert: {
          user_id: string
          creator_name: string
          bio?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          creator_name?: string
          bio?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
```

New:

```ts
      creator_profiles: {
        Row: {
          user_id: string
          creator_name: string
          bio: string | null
          status: string
          created_at: string
          studio_name: string | null
          location: string | null
          website_url: string | null
        }
        Insert: {
          user_id: string
          creator_name: string
          bio?: string | null
          status?: string
          created_at?: string
          studio_name?: string | null
          location?: string | null
          website_url?: string | null
        }
        Update: {
          user_id?: string
          creator_name?: string
          bio?: string | null
          status?: string
          created_at?: string
          studio_name?: string | null
          location?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no new errors (this is an additive change to an existing `Row`/`Insert`/`Update` shape; all fields are optional/nullable so no existing call site breaks).

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): add studio_name/location/website_url to creator_profiles type"
```

### Task 2c — Signup form (`/configurar-perfil-creador`)

**Files:**
- Modify: `app/configurar-perfil-creador/page.tsx` (full file — it's short, rewritten below with the new fields added)

- [ ] **Step 1: Replace the file**

Current behavior to preserve exactly: redirect to `/` if no session, redirect to `/perfiles` if a `creator_profiles` row already exists, prefill `creatorName` from Google metadata, insert on submit, redirect to `/perfiles` on success. Only addition: `studio_name` (required, new), `location` and `website_url` (optional, new).

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ConfigurarPerfilCreadorPage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("");
  const [studioName,  setStudioName]  = useState("");
  const [location,    setLocation]    = useState("");
  const [websiteUrl,  setWebsiteUrl]  = useState("");
  const [loading,     setLoading]     = useState(false);
  const [init,        setInit]        = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) { router.replace("/perfiles"); return; }

      const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
      setCreatorName(metaName);
      setInit(false);
    }
    void check();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName   = creatorName.trim();
    const trimmedStudio = studioName.trim();
    if (!trimmedName || !trimmedStudio) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    const { error: err } = await supabase
      .from("creator_profiles")
      .insert({
        user_id:      user.id,
        creator_name: trimmedName,
        studio_name:  trimmedStudio,
        location:     location.trim()    || null,
        website_url:  websiteUrl.trim()  || null,
      });

    if (err) {
      setError("Error al guardar. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      router.push("/perfiles");
      router.refresh();
    }
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0A0F17" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "#0A0F17" }}>
      <div
        className="w-full"
        style={{
          maxWidth: 420,
          background: "#111827",
          border: "1px solid #1E2D42",
          borderRadius: 16,
          padding: "40px 36px",
        }}
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Perfil Creador</span>
        </div>

        <h1 className="mb-1 mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-white">
          Un último paso
        </h1>
        <p className="mb-8 text-[13px] text-[#5A6A7E]">
          ¿Cómo quieres que te conozca la comunidad?
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre artístico o del proyecto
            </label>
            <input
              type="text"
              autoFocus
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Tu nombre de creador"
              maxLength={60}
              required
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre del estudio
            </label>
            <input
              type="text"
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              placeholder="Nombre de tu productora o estudio"
              maxLength={80}
              required
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Ubicación <span className="text-[#4A5A6E]/70">(opcional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ciudad, país"
              maxLength={80}
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Web <span className="text-[#4A5A6E]/70">(opcional)</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://tu-web.com"
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !creatorName.trim() || !studioName.trim()}
            className="mt-2 w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Empezar a crear →"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```
Sign up as a new creator via Google (or via the `creator-register-card.tsx` Google button) with the `gma_creator_pending` cookie path, confirm the form now asks for studio name (required) plus location/web (optional), and that submitting inserts a row with all fields populated (check via Supabase table editor or `select * from creator_profiles where user_id = '<id>'`).

- [ ] **Step 3: Commit**

```bash
git add app/configurar-perfil-creador/page.tsx
git commit -m "feat(creator-signup): collect studio_name, location, website_url"
```

### Task 2d — Wire `studio-profile-view.tsx` to real data

**Files:**
- Modify: `components/features/studio/studio-screen.tsx:1-32` (fetch real creator row, merge into mock data)
- Modify: `components/features/studio/studio-profile-view.tsx:42-64` (persist on save instead of toast-only)
- Test: manual

This only touches the `creator` identity fields (`studioName`, `artistName`, `bio`, `location`, `socials.web`). `titles`, `stats`, `recentComments`, etc. remain `STUDIO_DATA` mock — out of scope (per memory `project-mi-estudio-rebuild.md`, a `studio_titles` table is future work, not part of this spec). `role`, `instagram`, `vimeo` stay local-only/unsaved (no DB column in this spec's scope, per Resolved Contradiction #3) — they keep working exactly as they did before (cosmetic, not persisted), so this is not a regression.

- [ ] **Step 1: Fetch the real row in `StudioScreen` and merge it into the mock data**

Current (`studio-screen.tsx:1-31`):

```tsx
"use client";

import { useState } from "react";
import { Home, Film, Upload, BarChart2, User, Check, AlertTriangle } from "lucide-react";
import { DashboardView } from "./studio-dashboard-view";
import { TitlesView }    from "./studio-titles-view";
import { UploadView }    from "./studio-upload-view";
import { StatsView }     from "./studio-stats-view";
import { ProfileView }   from "./studio-profile-view";
import { EditModal }     from "./studio-edit-modal";
import { C, row }        from "./studio-ui";
import { STUDIO_DATA }   from "./studio-data";
import type { StudioTitle, StudioTabId } from "./studio-types";
export type { StudioTabId };

const TABS: { id: StudioTabId; label: string; icon: React.ReactNode }[] = [
  { id: "inicio",       label: "Inicio",         icon: <Home size={15} /> },
  { id: "titulos",      label: "Mis títulos",     icon: <Film size={15} /> },
  { id: "subir",        label: "Subir",           icon: <Upload size={15} /> },
  { id: "estadisticas", label: "Estadísticas",    icon: <BarChart2 size={15} /> },
  { id: "perfil",       label: "Perfil",          icon: <User size={15} /> },
];

export function StudioScreen() {
  const [active,    setActive]    = useState<StudioTabId>("inicio");
  const [editTitle, setEditTitle] = useState<StudioTitle | null>(null);
  const [openTitle, setOpenTitle] = useState<StudioTitle | null>(null);
  const [focusTitle, setFocusTitle] = useState<StudioTitle | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; error?: boolean; key: number } | null>(null);

  const data = STUDIO_DATA;
```

New — add the fetch effect and merge:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Home, Film, Upload, BarChart2, User, Check, AlertTriangle } from "lucide-react";
import { DashboardView } from "./studio-dashboard-view";
import { TitlesView }    from "./studio-titles-view";
import { UploadView }    from "./studio-upload-view";
import { StatsView }     from "./studio-stats-view";
import { ProfileView }   from "./studio-profile-view";
import { EditModal }     from "./studio-edit-modal";
import { C, row }        from "./studio-ui";
import { STUDIO_DATA }   from "./studio-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioTitle, StudioTabId } from "./studio-types";
export type { StudioTabId };

const TABS: { id: StudioTabId; label: string; icon: React.ReactNode }[] = [
  { id: "inicio",       label: "Inicio",         icon: <Home size={15} /> },
  { id: "titulos",      label: "Mis títulos",     icon: <Film size={15} /> },
  { id: "subir",        label: "Subir",           icon: <Upload size={15} /> },
  { id: "estadisticas", label: "Estadísticas",    icon: <BarChart2 size={15} /> },
  { id: "perfil",       label: "Perfil",          icon: <User size={15} /> },
];

export function StudioScreen() {
  const [active,    setActive]    = useState<StudioTabId>("inicio");
  const [editTitle, setEditTitle] = useState<StudioTitle | null>(null);
  const [openTitle, setOpenTitle] = useState<StudioTitle | null>(null);
  const [focusTitle, setFocusTitle] = useState<StudioTitle | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; error?: boolean; key: number } | null>(null);
  const [data,      setData]      = useState(STUDIO_DATA);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: row } = await supabase
        .from("creator_profiles")
        .select("creator_name, studio_name, bio, location, website_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return;

      setData((d) => ({
        ...d,
        creator: {
          ...d.creator,
          studioName: row.studio_name ?? d.creator.studioName,
          artistName: row.creator_name ?? d.creator.artistName,
          bio:        row.bio ?? d.creator.bio,
          location:   row.location ?? d.creator.location,
          socials:    { ...d.creator.socials, web: row.website_url ?? d.creator.socials.web },
        },
      }));
    })();
  }, []);
```

The rest of the component (`showToast`, `nav`, `openTitleAndGoToTitles`, the JSX tree referencing `data`) stays exactly as-is — `data` was already a local `const`, now it's `useState` so re-renders pick up the fetched row.

- [ ] **Step 2: Persist on save in `ProfileView`**

Current (`studio-profile-view.tsx:42-64`):

```tsx
export function ProfileView({ data, onToast }: Props) {
  const c = data.creator;
  const [form, setForm] = useState({
    studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio,
    location: c.location, instagram: c.socials.instagram.replace("@", ""),
    vimeo: c.socials.vimeo.replace("vimeo.com/", ""), web: c.socials.web,
  });
  const [dirty, setDirty] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
```

New — add the save handler and call it from the button:

```tsx
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ProfileView({ data, onToast }: Props) {
  const c = data.creator;
  const [form, setForm] = useState({
    studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio,
    location: c.location, instagram: c.socials.instagram.replace("@", ""),
    vimeo: c.socials.vimeo.replace("vimeo.com/", ""), web: c.socials.web,
  });
  const [dirty, setDirty]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  async function handleSave() {
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); onToast("No se pudo guardar: sesión no encontrada", { error: true }); return; }

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        studio_name:  form.studioName.trim(),
        creator_name: form.artistName.trim(),
        bio:          form.bio.trim().slice(0, 300),
        location:     form.location.trim() || null,
        website_url:  form.web.trim() || null,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      onToast("Error al guardar el perfil", { error: true });
    } else {
      setDirty(false);
      onToast("Perfil actualizado");
    }
  }
```

Replace the save button (currently `disabled={!dirty}` with an inline `onClick`):

```tsx
        <button className="st-btn st-btn-accent" disabled={!dirty || saving}
          onClick={() => void handleSave()}>
          <Check size={16} strokeWidth={2.2} /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npx next lint
```
Expected: no errors. (Reminder from the spec's notes: ESLint failures break the Vercel build in this repo — `let`/unused imports are real errors here, not warnings.)

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```
1. Log in as a creator account (one created via Task 2c, with `studio_name` set).
2. Go to `/mi-estudio` → "Perfil" tab — confirm the form is prefilled with the real `studio_name`/`creator_name`/`bio`/`location`/`web` instead of "Estudio Marea" mock data.
3. Change the studio name, click "Guardar cambios" — confirm the toast says "Perfil actualizado" and reloading the page shows the new value (i.e. it persisted, not just local state).
4. Check directly in Supabase (`select * from creator_profiles where user_id = '<id>'`) that the row was updated.

- [ ] **Step 5: Commit**

```bash
git add components/features/studio/studio-screen.tsx components/features/studio/studio-profile-view.tsx
git commit -m "feat(mi-estudio): wire profile tab to real creator_profiles data"
```

---

## Task 3: Gate `/configurar-perfil-creador` for new Google-OAuth creators only

**Files:**
- Modify: `app/auth/callback/route.ts:92-109` (the `isCreatorOAuth` block only — nothing else in this file changes)

Per Resolved Contradiction #4: this gate is scoped to the `gma_creator_pending` cookie path only. `mi-estudio/layout.tsx` is **not** touched.

- [ ] **Step 1: Update the `isCreatorOAuth` block**

Current (`app/auth/callback/route.ts:92-109`):

```ts
      // ── Creator OAuth path: redirect to creator setup ─────────────────────
      if (isCreatorOAuth) {
        const { data: existingCreator } = await supabase
          .from("creator_profiles")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!existingCreator) {
          const response = NextResponse.redirect(`${origin}/configurar-perfil-creador`);
          pendingCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
          response.cookies.set("gma_creator_pending", "", { path: "/", maxAge: 0, sameSite: "lax" });
          return response;
        }
      }
```

New — also select `studio_name` and redirect when it's missing, not just when the row is missing:

```ts
      // ── Creator OAuth path: redirect to creator setup ─────────────────────
      if (isCreatorOAuth) {
        const { data: existingCreator } = await supabase
          .from("creator_profiles")
          .select("user_id, studio_name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!existingCreator || !existingCreator.studio_name) {
          const response = NextResponse.redirect(`${origin}/configurar-perfil-creador`);
          pendingCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
          response.cookies.set("gma_creator_pending", "", { path: "/", maxAge: 0, sameSite: "lax" });
          return response;
        }
      }
```

Note: `/configurar-perfil-creador/page.tsx` (Task 2c) already redirects to `/perfiles` if a row exists at all — but since the row created by that page now always includes `studio_name` (it's a required field in the new form), a creator who completes the form once will never hit this loop. The only repeat visitors are the edge case from before this deploy: rows inserted by the *old* version of `configurar-perfil-creador` (creator_name only). Those will be sent back to the form once, complete `studio_name`, and never loop again.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual verification**

1. Use a fresh Google account (or delete a test creator row from `creator_profiles` in Supabase to simulate "new"), go through `CreatorRegisterCard`'s "Continuar con Google" button.
2. Confirm it lands on `/configurar-perfil-creador`, not `/mi-estudio` directly.
3. Complete the form (Task 2c) — confirm it now redirects to `/perfiles` (existing behavior of that page, unchanged) and that re-visiting `/auth/callback`'s flow (e.g. logging out and back in via Google) goes straight through without bouncing back to the form.
4. Confirm an **existing** creator account created via email signup (no `studio_name`) can still reach `/mi-estudio` directly without being redirected — this verifies the gate is scoped to the OAuth-pending path only, per the decision in Resolved Contradiction #4.

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "fix(auth): require studio_name before letting new Google creators reach mi-estudio"
```

---

## Task 4: Seed the 80-creator content directory (`artistas`)

**Files:**
- Create: `seed-creators.mjs` (repo root, alongside `generate-sprites.mjs` — following this repo's existing convention of plain `.mjs` data scripts run with `node`, not `ts-node`/`tsx`, which are not installed)
- Create: `creators-data.json` (repo root, alongside the script — **not created by this plan**, prepared manually by the user; the script only loads it)

### Step 1: Write the seed script

```js
/**
 * seed-creators.mjs
 *
 * Carga masiva de creadores en la tabla `artistas` a partir de creators-data.json.
 * Sigue el mismo patrón que generate-sprites.mjs: script plano de Node, carga
 * .env.local a mano (no hay ts-node/tsx en este repo).
 *
 * Uso: node seed-creators.mjs
 * Requiere: streaming-app/.env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const path = "./streaming-app/.env.local";
  const env  = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const creators = JSON.parse(readFileSync("./creators-data.json", "utf-8"));

  for (const creator of creators) {
    const { error } = await supabase
      .from("artistas")
      .upsert(
        {
          name:         creator.name,
          slug:         creator.slug,
          bio:          creator.bio ?? null,
          r2_photo_url: creator.r2_photo_url ?? null,
        },
        { onConflict: "slug" },
      );

    if (error) {
      console.error(`❌ Error en ${creator.name}:`, error.message);
    } else {
      console.log(`✓ ${creator.name}`);
    }
  }
}

main();
```

`creators-data.json` format (matches the real `artistas` columns — not the spec's original `user_id`/`studio_name` shape, which belongs to the unrelated `creator_profiles` table):

```json
[
  {
    "name": "Nombre real del creador",
    "slug": "nombre-real-del-creador",
    "bio": "Bio corta",
    "r2_photo_url": "https://..."
  }
]
```

### Step 2: Run it

```bash
node seed-creators.mjs
```
Expected: one `✓ <nombre>` line per creator in `creators-data.json`, or a `❌` line with the Supabase error message for any row that fails (e.g. slug collision with a different upsert key) — the loop does not stop on individual errors, matching the original spec's "no detener el proceso" requirement.

### Step 3: Commit

```bash
git add seed-creators.mjs
git commit -m "feat(data): add seed script for artistas (creator directory)"
```
(Do not commit `creators-data.json` if it contains data the user considers sensitive/unfinished — confirm with them; it's listed as user-prepared input, not generated by this plan.)

### Open item — do not act on this without DB access to verify

`/creadores/[slug]` actually reads from `creator_public_profiles` (`lib/supabase/queries.ts:410, 432`), which has fields `artistas` doesn't (`nacionalidad`, `imagen_portada`, `donacion_paypal/patreon/bitcoin`, `redes_sociales`, `titulos`). This repo has no migration that creates `creator_public_profiles`, so its real definition is unknown from the code alone. Two possibilities, and the next step depends on which is true:

- **If it's a plain `VIEW ... AS SELECT * FROM artistas`** (or similar): seeding `artistas` (this task) is sufficient, the view picks it up automatically, and the extra fields (`nacionalidad`, donations, etc.) simply render as empty in `CreatorProfilePage` until someone adds real values some other way.
- **If it's a separate table** with its own rows keyed by `slug`: this seed script needs a second `upsert` step against `creator_public_profiles` directly, and `creators-data.json` needs the extra fields.

Recommend running `\d+ creator_public_profiles` (or checking "Database → Tables" in the Supabase dashboard) before relying on this seed alone to populate the live `/creadores/[slug]` pages.
