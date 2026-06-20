# Donation Panel + Creator Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a donation panel (PayPal/Patreon/Bitcoin/QR) to the video player and public creator profile pages at `/creadores/[slug]`, linking creator names throughout the UI.

**Architecture:** Static data layer (Supabase `creator_public_profiles` table already created and seeded) feeds three touch-points: the player donation panel, the creator profile page, and clickable names in film detail and player credits. The `ArtistCredit` type gains a `slug` field, propagated from the existing DB join that already selects `artistas.slug`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase, Tailwind CSS v4, `qrcode.react` (new), `motion/react`, Lucide React.

---

## File Map

| File | Action |
|---|---|
| `types/creator.ts` | **Create** — `CreatorProfile` + `SocialLink` types |
| `types/catalog.ts` | **Modify** — add `slug?: string \| null` to `ArtistCredit` |
| `lib/supabase/queries.ts` | **Modify** — extend artista mapping + 3 new queries |
| `app/(platform)/creadores/[slug]/page.tsx` | **Create** — Server Component creator page |
| `components/features/creator/creator-profile.tsx` | **Create** — full creator profile UI |
| `components/features/player/donation-panel.tsx` | **Create** — DonationPanel + QR (client component) |
| `components/features/player/player-screen.tsx` | **Modify** — DonationBanner gains `onOpenPanel`, PlayerScreen gains `creator` prop |
| `app/ver/[id]/page.tsx` | **Modify** — fetch creator and pass to PlayerScreen |
| `components/features/detail/movie-detail.tsx` | **Modify** — director name becomes clickable Link |
| `.env.example` | **Modify** — document `NEXT_PUBLIC_APP_URL` |
| `package.json` | **Modify** — add `qrcode.react` |

---

## Task 1: Install qrcode.react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd "C:\Users\gfrom\Desktop\Apps web\GMA\streaming-app"
npm install qrcode.react
```

Expected output: `added 1 package` (or similar). Version will be 3.x.

- [ ] **Step 2: Verify types are bundled**

```bash
cat node_modules/qrcode.react/lib/index.d.ts | head -5
```

Expected: TypeScript declarations present (no `@types/qrcode.react` needed — types are bundled).

- [ ] **Step 3: Document the env var**

In `.env.example`, add after the last line:

```
NEXT_PUBLIC_APP_URL=https://gma-filmo.vercel.app  # Public base URL for QR codes
```

---

## Task 2: Add CreatorProfile types

**Files:**
- Create: `types/creator.ts`
- Modify: `types/catalog.ts`

- [ ] **Step 1: Create `types/creator.ts`**

```typescript
export interface SocialLink {
  readonly platform: string;
  readonly url: string;
}

export interface CreatorProfile {
  readonly slug: string;
  readonly nombre: string;
  readonly foto_perfil: string | null;
  readonly imagen_portada: string | null;
  readonly nacionalidad: string | null;
  readonly bio: string | null;
  readonly redes_sociales: readonly SocialLink[];
  readonly donacion_paypal: string | null;
  readonly donacion_patreon: string | null;
  readonly donacion_bitcoin: string | null;
  readonly titulos: readonly string[];
}
```

- [ ] **Step 2: Extend `ArtistCredit` in `types/catalog.ts`**

Find the existing `ArtistCredit` interface (lines 1–5) and add `slug`:

```typescript
export interface ArtistCredit {
  readonly name: string;
  readonly role: string;
  readonly photoUrl: string | null;
  readonly slug?: string | null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\gfrom\Desktop\Apps web\GMA\streaming-app"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (the new optional field is backward-compatible).

- [ ] **Step 4: Commit**

```bash
git add types/creator.ts types/catalog.ts .env.example package.json package-lock.json
git commit -m "feat: add CreatorProfile type and ArtistCredit.slug field"
```

---

## Task 3: Extend Supabase queries

**Files:**
- Modify: `lib/supabase/queries.ts`

**Context:** `SELECT_WITH_COLS` (line 178) already selects `artistas(name, slug, r2_photo_url)`. The slug is fetched from DB but not mapped into `ArtistCredit`. The `PeliculaWithRelations` type also does not include `slug` in its artistas shape.

- [ ] **Step 1: Fix the `PeliculaWithRelations` type and `ArtistaEntry` type**

In `queries.ts`, find the type definitions around lines 43–66 and update:

```typescript
// Change this:
type PeliculaWithRelations = PeliculaRow & {
  peliculas_colecciones: { colecciones: { name: string } | null }[];
  peliculas_artistas: {
    artistas: { name: string; slug: string; r2_photo_url: string | null } | null;
  }[];
};

// ArtistaEntry already exists but needs slug:
type ArtistaEntry = { name: string; r2_photo_url: string | null; slug: string };
```

- [ ] **Step 2: Update `fetchArtistaMapCached` to store slug in ArtistaEntry**

Find the `fetchArtistaMapCached` block (~lines 70–85). In the loop where entries are pushed, add `slug`:

```typescript
for (const a of (data ?? [])) {
  const entry: ArtistaEntry = { name: a.name, r2_photo_url: a.r2_photo_url, slug: a.slug };
  entries.push([a.name.toLowerCase(), entry]);
  entries.push([a.slug.toLowerCase(), entry]);
  entries.push([a.slug.replace(/-/g, " ").toLowerCase(), entry]);
}
```

- [ ] **Step 3: Update `toMovieMedia` to map `slug` into `ArtistCredit`**

Find the primary artistas mapping (~lines 135–141):

```typescript
const artistas: ArtistCredit[] = p.peliculas_artistas
  .filter((pa) => pa.artistas != null)
  .map((pa) => ({
    name:     pa.artistas!.name,
    role:     roleByName.get(pa.artistas!.name.toLowerCase()) ?? "",
    photoUrl: pa.artistas!.r2_photo_url,
    slug:     pa.artistas!.slug ?? null,
  }));
```

Find the fallback artistas mapping (~lines 144–151):

```typescript
if (artistas.length === 0 && p.author && artistaMap) {
  for (const credit of parseAuthorCredits(p.author)) {
    const match = artistaMap.get(credit.name.toLowerCase());
    if (match) {
      artistas.push({ name: match.name, role: credit.role, photoUrl: match.r2_photo_url, slug: match.slug ?? null });
    }
  }
}
```

- [ ] **Step 4: Add import for CreatorProfile and add `mapCreatorRow` helper**

At the top of `queries.ts`, add the import after the existing imports:

```typescript
import type { CreatorProfile } from "@/types/creator";
```

Then add this helper function before the `// ── Queries` comment (~line 177):

```typescript
// ── Creator profile mapper ────────────────────────────────────────────────────
function mapCreatorRow(data: Record<string, unknown>): CreatorProfile {
  return {
    slug:             data.slug as string,
    nombre:           data.nombre as string,
    foto_perfil:      (data.foto_perfil as string | null)      ?? null,
    imagen_portada:   (data.imagen_portada as string | null)   ?? null,
    nacionalidad:     (data.nacionalidad as string | null)     ?? null,
    bio:              (data.bio as string | null)              ?? null,
    redes_sociales:   (data.redes_sociales as { platform: string; url: string }[]) ?? [],
    donacion_paypal:  (data.donacion_paypal as string | null)  ?? null,
    donacion_patreon: (data.donacion_patreon as string | null) ?? null,
    donacion_bitcoin: (data.donacion_bitcoin as string | null) ?? null,
    titulos:          (data.titulos as string[])               ?? [],
  };
}
```

- [ ] **Step 5: Add three new exported query functions**

Append these at the end of `queries.ts`:

```typescript
// ── Creator public profiles ───────────────────────────────────────────────────

export async function getCreatorBySlug(slug: string): Promise<CreatorProfile | null> {
  return unstable_cache(
    async () => {
      const supabase = getSupabasePublicClient();
      const { data } = await supabase
        .from("creator_public_profiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) return null;
      return mapCreatorRow(data as Record<string, unknown>);
    },
    [`creator-${slug}`],
    { revalidate: 3600 },
  )();
}

export async function getCreatorFilmsByTitulos(titulos: readonly string[]): Promise<MovieMedia[]> {
  if (!titulos.length) return [];
  const all = await getPeliculas();
  return all.filter((m) => titulos.includes(m.id));
}

export async function getCreatorByArtistaSlugs(slugs: string[]): Promise<CreatorProfile | null> {
  if (!slugs.length) return null;
  const supabase = getSupabasePublicClient();
  const { data } = await supabase
    .from("creator_public_profiles")
    .select("*")
    .in("slug", slugs);
  if (!data?.length) return null;
  for (const s of slugs) {
    const found = data.find((r) => r.slug === s);
    if (found) return mapCreatorRow(found as Record<string, unknown>);
  }
  return null;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: extend artista mapping with slug, add creator profile queries"
```

---

## Task 4: Creator profile page + component

**Files:**
- Create: `app/(platform)/creadores/[slug]/page.tsx`
- Create: `components/features/creator/creator-profile.tsx`

- [ ] **Step 1: Create `components/features/creator/creator-profile.tsx`**

```typescript
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PosterCard } from "@/components/ui/poster-card";
import type { CreatorProfile } from "@/types/creator";
import type { MovieMedia } from "@/types/catalog";

function slugToHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h * 31) + slug.charCodeAt(i)) >>> 0;
  return h % 360;
}

function InitialAvatar({ nombre, size = 60 }: { nombre: string; size?: number }) {
  const COLORS = ["#22B16B","#3a8fb7","#f0c14b","#e63946","#9B6FD4","#3BAED4"];
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = ((h * 31) + nombre.charCodeAt(i)) >>> 0;
  const bg = COLORS[h % COLORS.length]!;
  return (
    <div
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-[#031A0E]"
    >
      {(nombre[0] ?? "?").toUpperCase()}
    </div>
  );
}

const DONATION_BUTTONS = [
  {
    key: "paypal" as const,
    label: "Donar por PayPal",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.72A.641.641 0 0 1 5.577 2h7.022c2.33 0 3.984.65 4.96 1.948.93 1.234 1.096 2.795.501 4.715-.847 2.766-2.951 4.213-6.254 4.29l-1.286.02-.613 3.875a.641.641 0 0 1-.633.54H7.076zm4.99-13.073c1.93 0 3.145.677 3.641 2.016.366.993.257 2.207-.322 3.61-.793 1.942-2.213 2.913-4.219 2.913h-.37l.494-3.116a.641.641 0 0 0-.633-.74H9.4l.948-5.988c.527.194 1.067.305 1.718.305z" />
      </svg>
    ),
  },
  {
    key: "patreon" as const,
    label: "Apoyar en Patreon",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z" />
      </svg>
    ),
  },
  {
    key: "bitcoin" as const,
    label: "Dirección Bitcoin",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
  },
] as const;

interface CreatorProfileProps {
  readonly creator: CreatorProfile;
  readonly films: readonly MovieMedia[];
}

export function CreatorProfilePage({ creator, films }: CreatorProfileProps) {
  const hue = slugToHue(creator.slug);
  const hasCover = Boolean(creator.imagen_portada);

  return (
    <div className="min-h-screen" style={{ background: "#0A0F17" }}>
      {/* ── Banner header ──────────────────────────────────────────────── */}
      <div className="relative h-56 overflow-hidden">
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.imagen_portada!}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, hsl(${hue},40%,8%) 0%, hsl(${(hue + 40) % 360},35%,16%) 100%)`,
            }}
          />
        )}
        {/* Gradient overlay — bottom fade to page bg */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent 20%, rgba(10,15,23,0.7) 60%, #0A0F17 100%)",
          }}
        />
      </div>

      {/* ── Identity row (overlaps banner) ────────────────────────────── */}
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="-mt-10 flex flex-wrap items-end gap-5">
          {/* Avatar */}
          <div className="shrink-0 rounded-full ring-2 ring-[#22B16B] ring-offset-2 ring-offset-[#0A0F17]">
            {creator.foto_perfil ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.foto_perfil}
                alt={creator.nombre}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <InitialAvatar nombre={creator.nombre} size={72} />
            )}
          </div>

          {/* Name + nationality */}
          <div className="flex flex-1 flex-col gap-0.5 pb-1">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              {creator.nombre}
            </h1>
            {creator.nacionalidad && (
              <p className="text-[13px] text-[#6D7D94]">{creator.nacionalidad}</p>
            )}
          </div>

          {/* Donation buttons */}
          <div className="flex shrink-0 flex-wrap gap-2 pb-1">
            {DONATION_BUTTONS.map(({ key, label, icon }) => {
              const url = creator[`donacion_${key}`];
              if (!url) return null;
              const href = key === "bitcoin" ? `bitcoin:${url}` : url;
              return (
                <motion.a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full border border-[#1E2D42] px-4 py-2 text-[13px] font-semibold text-[#B8C5D4] transition-colors duration-150 hover:border-[#22B16B]/40 hover:bg-[#22B16B]/10 hover:text-[#22B16B]"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  {icon}
                  {label}
                </motion.a>
              );
            })}
          </div>
        </div>

        {/* ── Bio ────────────────────────────────────────────────────────── */}
        {creator.bio && (
          <p className="mt-6 max-w-[680px] text-[15px] leading-[1.7] text-[#B8C5D4]">
            {creator.bio}
          </p>
        )}

        {/* ── Filmography ────────────────────────────────────────────────── */}
        <section className="mt-10 pb-20">
          <h2 className="mb-6 text-[18px] font-extrabold tracking-[-0.01em] text-white">
            Filmografía en GMA Filmo
          </h2>
          {films.length === 0 ? (
            <p className="text-[14px] text-[#6D7D94]">
              Próximamente más contenido de este creador.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {films.map((film) => (
                <Link key={film.id} href={`/cortos/${film.id}`} className="block">
                  <PosterCard item={film} ratio="portrait" fluid />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(platform)/creadores/[slug]/page.tsx`**

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreatorBySlug, getCreatorFilmsByTitulos } from "@/lib/supabase/queries";
import { CreatorProfilePage } from "@/components/features/creator/creator-profile";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = await getCreatorBySlug(params.slug);
  if (!creator) return { title: "Creador" };
  return { title: `${creator.nombre} — GMA Filmo` };
}

export default async function CreatorPage({ params }: Props) {
  const creator = await getCreatorBySlug(params.slug);
  if (!creator) notFound();

  const films = await getCreatorFilmsByTitulos(creator.titulos);

  return <CreatorProfilePage creator={creator} films={films} />;
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(platform)/creadores components/features/creator
git commit -m "feat: add /creadores/[slug] public creator profile page"
```

---

## Task 5: DonationPanel component (player)

**Files:**
- Create: `components/features/player/donation-panel.tsx`

- [ ] **Step 1: Create `components/features/player/donation-panel.tsx`**

```typescript
"use client";

import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import { motion } from "motion/react";
import type { CreatorProfile } from "@/types/creator";

const PLATFORM_BUTTONS = [
  {
    key: "paypal" as const,
    label: "Donar por PayPal",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.72A.641.641 0 0 1 5.577 2h7.022c2.33 0 3.984.65 4.96 1.948.93 1.234 1.096 2.795.501 4.715-.847 2.766-2.951 4.213-6.254 4.29l-1.286.02-.613 3.875a.641.641 0 0 1-.633.54H7.076zm4.99-13.073c1.93 0 3.145.677 3.641 2.016.366.993.257 2.207-.322 3.61-.793 1.942-2.213 2.913-4.219 2.913h-.37l.494-3.116a.641.641 0 0 0-.633-.74H9.4l.948-5.988c.527.194 1.067.305 1.718.305z" />
      </svg>
    ),
  },
  {
    key: "patreon" as const,
    label: "Apoyar en Patreon",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.18-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z" />
      </svg>
    ),
  },
  {
    key: "bitcoin" as const,
    label: "Dirección Bitcoin",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
  },
] as const;

interface DonationPanelProps {
  readonly creator: CreatorProfile | null;
  readonly appUrl: string;
  readonly onClose: () => void;
}

export function DonationPanel({ creator, appUrl, onClose }: DonationPanelProps) {
  const profileUrl = creator
    ? `${appUrl}/creadores/${creator.slug}`
    : appUrl;

  const hasAnyDonation = creator && (
    creator.donacion_paypal || creator.donacion_patreon || creator.donacion_bitcoin
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 30, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10"
        style={{ background: "rgba(10,13,20,0.98)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-[15px] font-bold text-white">
            {creator ? `Apoya a ${creator.nombre}` : "Apoya al creador"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de donación"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/40 transition-colors duration-150 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex gap-5 p-5">
          {/* QR */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="rounded-[10px] border border-white/10 p-2.5" style={{ background: "#0D0D0D" }}>
              <QRCodeSVG
                value={profileUrl}
                size={100}
                bgColor="#0D0D0D"
                fgColor="#22B16B"
                level="M"
              />
            </div>
            <p className="max-w-[120px] text-center text-[10px] leading-tight text-[#6D7D94]">
              Escanea para ver el perfil completo
            </p>
          </div>

          {/* Donation buttons */}
          <div className="flex flex-1 flex-col justify-center gap-2">
            {hasAnyDonation ? (
              PLATFORM_BUTTONS.map(({ key, label, icon }) => {
                const val = creator![`donacion_${key}`];
                if (!val) return null;
                const href = key === "bitcoin" ? `bitcoin:${val}` : val;
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-full border border-[#1E2D42] px-4 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors duration-150 hover:border-[#22B16B]/50 hover:bg-[#22B16B]/10 hover:text-[#22B16B]"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {icon}
                    {label}
                  </a>
                );
              })
            ) : (
              <p className="text-[13px] leading-relaxed text-[#6D7D94]">
                Escanea el QR para visitar el perfil del creador y apoyar su trabajo.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/player/donation-panel.tsx
git commit -m "feat: add DonationPanel component with QR and PayPal/Patreon/Bitcoin buttons"
```

---

## Task 6: Wire DonationPanel into PlayerScreen

**Files:**
- Modify: `components/features/player/player-screen.tsx`
- Modify: `app/ver/[id]/page.tsx`

- [ ] **Step 1: Add imports to `player-screen.tsx`**

At the top of `player-screen.tsx`, add these imports after the existing imports:

```typescript
import { DonationPanel } from "@/components/features/player/donation-panel";
import type { CreatorProfile } from "@/types/creator";
```

- [ ] **Step 2: Update `PlayerScreenProps`**

Find the `PlayerScreenProps` interface (~line 156) and add `creator`:

```typescript
interface PlayerScreenProps {
  readonly item: MediaItem;
  readonly nextItem?: MediaItem;
  readonly creator?: CreatorProfile | null;
}
```

- [ ] **Step 3: Update `PlayerScreen` function signature and add state**

Find the `export function PlayerScreen({ item, nextItem }: PlayerScreenProps)` line (~line 229) and update:

```typescript
export function PlayerScreen({ item, nextItem, creator }: PlayerScreenProps) {
```

Find the block of `useState` declarations. After the `showDonation`/`donationShown` lines (~line 249–250), add:

```typescript
const [showDonationPanel, setShowDonationPanel] = useState(false);
```

- [ ] **Step 4: Update `DonationBanner` function signature and button**

Find the `DonationBanner` function (~line 163). Update its props and the button's `onClick`:

```typescript
function DonationBanner({ visible, onClose, onOpenPanel }: {
  visible: boolean;
  onClose: () => void;
  onOpenPanel: () => void;
}) {
```

Inside the function, find the `<button>` that says "donando aquí" (~line 179) and change its `onClick` from `onClose` to `onOpenPanel`:

```typescript
<button
  type="button"
  onClick={onOpenPanel}
  className="font-semibold text-[#22B16B] underline underline-offset-2 transition-opacity hover:opacity-80"
>
  donando aquí
</button>
```

- [ ] **Step 5: Update `DonationBanner` usage in `PlayerScreen`**

Find where `DonationBanner` is rendered (~line 838):

```typescript
{/* ── Donation banner ─────────────────────────────────────────────── */}
<DonationBanner
  visible={showDonation}
  onClose={() => setShowDonation(false)}
  onOpenPanel={() => setShowDonationPanel(true)}
/>
```

- [ ] **Step 6: Add `DonationPanel` render in `PlayerScreen`**

After the `DonationBanner` render line (~line 839), add:

```typescript
{/* ── Donation panel ──────────────────────────────────────────────── */}
{showDonationPanel && (
  <DonationPanel
    creator={creator ?? null}
    appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://gma-filmo.vercel.app"}
    onClose={() => setShowDonationPanel(false)}
  />
)}
```

- [ ] **Step 7: Update `/ver/[id]/page.tsx`**

Replace the entire file content:

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPeliculaBySlug,
  getRelatedPeliculas,
  getCreatorByArtistaSlugs,
} from "@/lib/supabase/queries";
import { PlayerScreen } from "@/components/features/player/player-screen";

interface Props {
  params: { id: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPeliculaBySlug(params.id);
  return { title: item?.title ?? "Reproduciendo" };
}

export default async function PlayerPage({ params }: Props) {
  const item = await getPeliculaBySlug(params.id);
  if (!item) notFound();

  const artistaSlugs = (item.artistas ?? [])
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  const [nextItem, creator] = await Promise.all([
    getRelatedPeliculas(params.id, item.categories, 1, {
      author: item.author,
      year: item.year,
    }).then(([first]) => first),
    getCreatorByArtistaSlugs(artistaSlugs),
  ]);

  return <PlayerScreen item={item} nextItem={nextItem} creator={creator} />;
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/features/player/player-screen.tsx app/ver/\[id\]/page.tsx
git commit -m "feat: wire DonationPanel into player with creator data from Supabase"
```

---

## Task 7: Clickable director in movie-detail.tsx

**Files:**
- Modify: `components/features/detail/movie-detail.tsx`

- [ ] **Step 1: Add Link import**

At the top of `movie-detail.tsx`, add after existing imports:

```typescript
import Link from "next/link";
```

- [ ] **Step 2: Update `parseAuthorField` to return slugs**

Find the existing `parseAuthorField` function (~line 165) and update its return type and body:

```typescript
function parseAuthorField(
  raw: string | null | undefined,
  artistas?: MovieMedia["artistas"],
): { director: string | null; illustrator: string | null; directorSlug: string | null; illustratorSlug: string | null } {
  if (artistas && artistas.length > 0) {
    const directorArtist    = artistas.find((a) => /creador|director/i.test(a.role)) ?? artistas[0];
    const illustratorArtist = artistas.find((a) => /ilustrador|illustrator/i.test(a.role));
    return {
      director:       directorArtist?.name    ?? null,
      illustrator:    illustratorArtist?.name ?? null,
      directorSlug:   directorArtist?.slug    ?? null,
      illustratorSlug: illustratorArtist?.slug ?? null,
    };
  }
  if (!raw) return { director: null, illustrator: null, directorSlug: null, illustratorSlug: null };
  const creado = raw.match(/Creado por:\s*([^;]+)/i);
  const ilustr  = raw.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
  if (creado || ilustr) {
    return {
      director:       creado?.[1]?.trim() ?? null,
      illustrator:    ilustr?.[1]?.trim()  ?? null,
      directorSlug:   null,
      illustratorSlug: null,
    };
  }
  return { director: raw.trim(), illustrator: null, directorSlug: null, illustratorSlug: null };
}
```

- [ ] **Step 3: Update `StatsRow` to use directorSlug**

Find `StatsRow` (~line 190). Replace the director stats entry render:

```typescript
function StatsRow({ movie }: { movie: MovieMedia }) {
  const { director, directorSlug } = parseAuthorField(movie.author, movie.artistas);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Estreno */}
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-5 text-center">
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7D94]">Estreno</span>
        <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">{String(movie.year)}</span>
      </div>
      {/* Duración */}
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-5 text-center">
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7D94]">Duración</span>
        <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">{movie.runtime}</span>
      </div>
      {/* Director */}
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-5 text-center">
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7D94]">Director</span>
        {director && directorSlug ? (
          <Link
            href={`/creadores/${directorSlug}`}
            className="text-[22px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-[#22B16B] hover:underline"
          >
            {director}
          </Link>
        ) : (
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
            {director ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `MetaCard` to use directorSlug and illustratorSlug**

Find `MetaCard` (~line 249). Update the inner block that calls `parseAuthorField`:

```typescript
{(() => {
  const { director, illustrator, directorSlug, illustratorSlug } = parseAuthorField(movie.author, movie.artistas);
  return (
    <>
      <MetaRow label="Año"      value={String(movie.year)} />
      <MetaRow label="Duración" value={movie.runtime} />
      {director && (
        <MetaRow
          label="Director"
          value={director}
          linkHref={directorSlug ? `/creadores/${directorSlug}` : undefined}
        />
      )}
      {illustrator && (
        <MetaRow
          label="Ilustrador"
          value={illustrator}
          linkHref={illustratorSlug ? `/creadores/${illustratorSlug}` : undefined}
        />
      )}
      {movie.tag && <MetaRow label="Producción" value={movie.tag} accent />}
    </>
  );
})()}
```

- [ ] **Step 5: Update `MetaRow` to accept optional `linkHref`**

Find `MetaRow` (~line 296) and update:

```typescript
function MetaRow({ label, value, accent, linkHref }: {
  label: string;
  value: string;
  accent?: boolean;
  linkHref?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[12px] text-[#6D7D94]">{label}</dt>
      <dd className={`text-right text-[13px] font-semibold ${accent ? "text-[#22B16B]" : "text-white"}`}>
        {linkHref ? (
          <Link
            href={linkHref}
            className="transition-colors hover:text-[#22B16B] hover:underline"
          >
            {value}
          </Link>
        ) : value}
      </dd>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/features/detail/movie-detail.tsx
git commit -m "feat: make director name clickable link to creator profile"
```

---

## Task 8: Clickable credits in player-screen.tsx

**Files:**
- Modify: `components/features/player/player-screen.tsx`

- [ ] **Step 1: Add Link import**

At the top of `player-screen.tsx`, add to the existing Next.js imports:

```typescript
import Link from "next/link";
```

- [ ] **Step 2: Update the credits array to include slug**

Find the `credits` constant (~line 634):

```typescript
const credits: Array<{ name: string; role: string; photoUrl: string | null; slug?: string | null }> =
  item.artistas && item.artistas.length > 0
    ? item.artistas.map((a) => ({ name: a.name, role: a.role, photoUrl: a.photoUrl, slug: a.slug ?? null }))
    : item.author
      ? parseCredits(item.author).map((c) => ({ ...c, photoUrl: null, slug: null }))
      : [];
```

- [ ] **Step 3: Update the credits render to make names clickable**

Find the credits render block (~lines 804–830). Replace the inner content of each credit `div.flex.items-center.gap-2` — specifically the name `<p>` element:

```typescript
{credits.map((c) => (
  <div key={c.name} className="flex items-center gap-2">
    <div className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
      {c.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.photoUrl}
          alt={c.name}
          width={26}
          height={26}
          className="h-6.5 w-6.5 rounded-full object-cover"
        />
      ) : (
        <div
          style={{ width: 26, height: 26, background: creditInitialColor(c.name) }}
          className="flex items-center justify-center text-[11px] font-extrabold text-[#031A0E]"
        >
          {(c.name[0] ?? "?").toUpperCase()}
        </div>
      )}
    </div>
    <div>
      {c.slug ? (
        <Link
          href={`/creadores/${c.slug}`}
          className="pointer-events-auto text-[11px] font-semibold leading-none text-white/75 transition-colors hover:text-[#22B16B] hover:underline"
        >
          {c.name}
        </Link>
      ) : (
        <p className="text-[11px] font-semibold leading-none text-white/75">{c.name}</p>
      )}
      {c.role && <p className="mt-0.5 text-[10px] leading-none text-white/40">{c.role}</p>}
    </div>
  </div>
))}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Final commit**

```bash
git add components/features/player/player-screen.tsx
git commit -m "feat: make player credits clickable links to creator profiles"
```

---

## Self-Review Checklist

- [x] **Donation banner → panel flow** — DonationBanner gains `onOpenPanel`, DonationPanel mounts with `AnimatePresence` pattern, X closes it (Tasks 5–6)
- [x] **QR code** — `QRCodeSVG` from `qrcode.react`, points to `${appUrl}/creadores/${slug}` (Task 5)
- [x] **PayPal/Patreon/Bitcoin buttons** — conditionally rendered when not null, open `target="_blank"` (Tasks 4 & 5)
- [x] **Creator profile page** — header banner, avatar, bio, donation buttons, filmography grid (Task 4)
- [x] **80 stubs** — seeded via SQL from `artistas` table (manual step, documented in spec)
- [x] **Director clickable in detail** — StatsRow + MetaCard updated (Task 7)
- [x] **Credits clickable in player** — `pointer-events-auto` on links inside `pointer-events-none` container (Task 8)
- [x] **ArtistCredit.slug propagated** — `toMovieMedia` maps it from the existing DB join (Task 3)
- [x] **No `next/image` needed** — creator images use `<img>` with eslint-disable (consistent with existing pattern)
- [x] **CSP** — creator images come from R2 (already in `img-src`); QR is inline SVG (no network)
- [x] **`NEXT_PUBLIC_APP_URL`** — used in DonationPanel with fallback to production URL
