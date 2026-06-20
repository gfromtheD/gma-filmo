# GMA Filmo — Panel de Donación y Fichas Públicas de Creadores

**Fecha:** 2026-06-15
**Estado:** Aprobado

---

## Resumen

Dos funcionalidades complementarias:

1. **Panel de donación en el reproductor** — Al finalizar un contenido, el banner existente activa un panel superpuesto con botones PayPal/Patreon/Bitcoin y un QR que apunta al perfil público del creador.
2. **Fichas públicas de creadores** — Página `/creadores/[slug]` con header tipo banner, filmografía en grid y botones de donación. 80 fichas pre-creadas desde la tabla `artistas` existente.

---

## 1. Capa de datos

### 1.1 Nueva tabla Supabase: `creator_public_profiles`

| Columna | Tipo | Notas |
|---|---|---|
| `slug` | `text PRIMARY KEY` | Coincide con `artistas.slug` |
| `nombre` | `text NOT NULL` | Nombre visible |
| `foto_perfil` | `text` | URL imagen perfil (R2/CDN) |
| `imagen_portada` | `text` | URL imagen banner header |
| `nacionalidad` | `text` | País de origen |
| `bio` | `text` | Texto libre, puede ser largo |
| `redes_sociales` | `jsonb DEFAULT '[]'` | `Array<{platform: string, url: string}>` |
| `donacion_paypal` | `text` | URL directa a página PayPal |
| `donacion_patreon` | `text` | URL directa a Patreon |
| `donacion_bitcoin` | `text` | Dirección BTC (no URL) |
| `titulos` | `text[] DEFAULT '{}'` | Slugs de sus films en GMA Filmo |
| `created_at` | `timestamptz DEFAULT now()` | |

**RLS:** Lectura pública (`SELECT` para `anon`). Sin escritura pública.

**Seed de 80 stubs** (ejecutar en Supabase SQL editor):
```sql
INSERT INTO creator_public_profiles (slug, nombre)
SELECT slug, name FROM artistas
ON CONFLICT (slug) DO NOTHING;
```

### 1.2 Tipos TypeScript

**Nuevo archivo `types/creator.ts`:**
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

**Extensión de `ArtistCredit` en `types/catalog.ts`:**
```typescript
export interface ArtistCredit {
  readonly name: string;
  readonly role: string;
  readonly photoUrl: string | null;
  readonly slug?: string | null;   // ← nuevo campo
}
```

### 1.3 Queries Supabase

Añadir a `lib/supabase/queries.ts`:

- **`getCreatorBySlug(slug: string): Promise<CreatorProfile | null>`** — Lee de `creator_public_profiles` por slug. Cacheada con `unstable_cache` TTL 1h.
- **`getCreatorFilmsByTitulos(titulos: string[]): Promise<MovieMedia[]>`** — Lee de `peliculas` por slugs. Devuelve los films mapeados al tipo `MovieMedia`.
- **`getCreatorByArtistaSlugs(artistaSlugs: string[]): Promise<CreatorProfile | null>`** — Dado un array de slugs de artistas (en orden: primero el director), devuelve el primer perfil que exista en `creator_public_profiles`.

**Extensión del mapeo existente de artistas** en `getPeliculaBySlug`:
El join `peliculas_artistas → artistas` ya trae `slug` del artista — añadirlo al objeto `ArtistCredit` mapeado.

---

## 2. Fichas públicas de creadores `/creadores/[slug]`

### 2.1 Ruta

```
app/(platform)/creadores/[slug]/page.tsx   ← Server Component, revalidate = 3600
components/features/creator/creator-profile.tsx
```

### 2.2 Layout

```
┌──────────────────────────────────────────────────────┐
│  BANNER (imagen_portada, h-56, object-cover)         │
│  Gradiente inferior rgba→#0A0F17                    │
│  ┌────┐  Nombre del Creador                          │
│  │foto│  Nacionalidad                                │
│  │ 60 │  Bio (max 3 líneas, expandible)              │
│  └────┘  [PayPal] [Patreon] [Bitcoin]  (si no null) │
└──────────────────────────────────────────────────────┘
│                                                      │
│  FILMOGRAFÍA EN GMA FILMO                           │
│  Grid responsive: 2 cols mobile → 4 cols desktop    │
│  Usa <PosterCard> existente (clicable → /cortos/id) │
│                                                      │
│  Si titulos[] vacío:                                │
│  "Próximamente más contenido de este creador"       │
└──────────────────────────────────────────────────────┘
```

### 2.3 Detalles de diseño

- **Banner sin imagen_portada:** gradiente generativo derivado del slug con `deriveStyle()` (ya existe en queries.ts). Fondo con los colores `tone` del estilo derivado.
- **Foto de perfil:** 60×60, `rounded-full`, ring `#22B16B` 2px, superpuesta en la zona inferior del banner. Si `foto_perfil` es null: inicial del nombre con color generativo (misma lógica que `creditInitialColor` del player).
- **Botones de donación:** `rounded-full`, borde `#1E2D42`, fondo `rgba(255,255,255,0.04)`. Solo se renderizan si el campo correspondiente no es null. Abren en `target="_blank" rel="noopener noreferrer"`.
- **notFound():** si el slug no existe en `creator_public_profiles`.
- **generateMetadata:** título `"[nombre] — GMA Filmo"`.

### 2.4 Sistema de diseño aplicado

- Fondo: `#0A0F17`
- Cards filmografía: `rounded-[14px]` borde `#1E1E1E`
- Texto primario: `#FFFFFF`, secundario: `#B8C5D4`, apagado: `#6D7D94`
- Acento: `#22B16B`, hover: `#2AC57A`

---

## 3. Panel de donación en el reproductor

### 3.1 Flujo

```
Video llega a 10s del final
    → DonationBanner aparece (comportamiento existente)
    → Usuario pulsa "donando aquí"
    → DonationPanel se abre (overlay)
    → Banner queda visible detrás
    → Usuario puede:
        (a) Pulsar X → cierra panel, continúa viendo
        (b) Pulsar PayPal/Patreon/Bitcoin → abre URL en nueva pestaña
        (c) Escanear QR → va al perfil del creador en móvil
```

### 3.2 Cambios en `DonationBanner`

- El botón "donando aquí" deja de llamar `onClose` y pasa a llamar `onOpenPanel`
- `DonationBanner` recibe prop adicional: `onOpenPanel: () => void`

### 3.3 Nuevo componente `DonationPanel`

```
┌────────────────────────────────────────────────────┐
│  Apoya a [Nombre]                               ✕  │
├──────────────────────────────────────────────────  │
│  ┌─────────┐   ┌──────────────────────────────┐   │
│  │         │   │  🅿  Donar por PayPal         │   │
│  │  QR SVG │   │  ⬡  Apoyar en Patreon        │   │
│  │ 100×100 │   │  ₿  Dirección Bitcoin         │   │
│  └─────────┘   └──────────────────────────────┘   │
│  Escanea para ver el perfil completo               │
└────────────────────────────────────────────────────┘
```

Props: `{ creator: CreatorProfile | null; appUrl: string; onClose: () => void }`

- Si `creator` es null: solo muestra el QR con texto genérico, sin botones de donación.
- **QR:** `<QRCodeSVG>` de `qrcode.react`. URL: `${appUrl}/creadores/${creator.slug}`. Tamaño 100, fondo `#0D0D0D`, color `#22B16B`.
- Posición: `absolute`, centrado en el reproductor, `z-30`.
- `onClick={(e) => e.stopPropagation()}` para no toggle play.
- Mientras el panel está abierto: se llama `revealControls()` periódicamente para evitar que los controles se oculten.

### 3.4 Cambios en `PlayerScreen`

- Nueva prop: `creator?: CreatorProfile | null`
- Nuevo estado: `const [showDonationPanel, setShowDonationPanel] = useState(false)`
- `DonationBanner` recibe `onOpenPanel={() => setShowDonationPanel(true)}`
- `DonationPanel` se renderiza cuando `showDonationPanel === true`

### 3.5 Cambios en `/ver/[id]/page.tsx`

La página ya obtiene la película de Supabase. Se añade:
```typescript
const artistas = movie.artistas ?? [];
const artistaSlugs = artistas.map(a => a.slug).filter(Boolean);
const creator = await getCreatorByArtistaSlugs(artistaSlugs);
```
Y se pasa `creator` a `<PlayerScreen>`.

### 3.6 Dependencia nueva

```bash
npm install qrcode.react
```

---

## 4. Nombres clicables en la UI existente

### 4.1 `movie-detail.tsx` — StatsRow y MetaCard

- El director se obtiene de `artistas` (ya existe `parseAuthorField`).
- Se añade función `parseAuthorFieldWithSlug` que devuelve también `{ directorSlug: string | null }`.
- Si `directorSlug` existe: el nombre en "Director" (StatsRow y MetaCard) se renderiza como `<Link href="/creadores/${directorSlug}">` con `className="hover:text-[#22B16B] hover:underline transition-colors"`.
- Si no existe: texto plano (sin cambio visual).

### 4.2 `player-screen.tsx` — Créditos en pausa

- En el bloque de créditos (líneas ~792–833), cada crédito comprueba `c.slug`.
- Si `c.slug` existe: el `<p>` con el nombre se envuelve en `<Link href="/creadores/${c.slug}">`. El contenedor padre tiene `pointer-events-none`; el link necesita `pointer-events-auto`.
- Mismo tratamiento visual: `hover:text-[#22B16B] hover:underline`.

---

## 5. Archivos afectados

| Archivo | Acción |
|---|---|
| `types/creator.ts` | Crear |
| `types/catalog.ts` | Editar — añadir `slug` a `ArtistCredit` |
| `lib/supabase/queries.ts` | Editar — 3 nuevas queries + mapeo slug en artistas |
| `app/(platform)/creadores/[slug]/page.tsx` | Crear |
| `components/features/creator/creator-profile.tsx` | Crear |
| `components/features/player/player-screen.tsx` | Editar — DonationBanner + DonationPanel |
| `components/features/detail/movie-detail.tsx` | Editar — director clicable |
| `app/ver/[id]/page.tsx` | Editar — pasar creator al player |
| `package.json` | Editar — añadir qrcode.react |

---

## 6. Orden de implementación

1. Crear tabla SQL + seed en Supabase (manual)
2. `npm install qrcode.react`
3. `types/creator.ts` + extensión `ArtistCredit`
4. Queries Supabase (getCreatorBySlug, getCreatorFilmsByTitulos, getCreatorByArtistaSlugs) + mapeo slug artistas
5. Página y componente `/creadores/[slug]`
6. Modificar `/ver/[id]/page.tsx` para pasar creator
7. Panel de donación en player (DonationBanner + DonationPanel)
8. Director clicable en movie-detail.tsx
9. Créditos clicables en player-screen.tsx
