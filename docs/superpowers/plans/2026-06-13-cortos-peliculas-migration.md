# Cortos/Películas Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renombrar la ruta `/peliculas` (cortometrajes) a `/cortos`, crear una nueva ruta `/peliculas` como placeholder para largometrajes, y añadir la pestaña "Películas" al navbar.

**Architecture:** Se mueven los tres archivos de ruta de `app/(platform)/peliculas/` a `app/(platform)/cortos/`. El antiguo `peliculas/page.tsx` se reemplaza con una página placeholder estática. Todos los links internos de 7 componentes se actualizan de `/peliculas` a `/cortos`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `app/(platform)/cortos/page.tsx` |
| Crear | `app/(platform)/cortos/[id]/page.tsx` |
| Crear | `app/(platform)/cortos/coleccion/[slug]/page.tsx` |
| Crear | `app/(platform)/peliculas/page.tsx` (placeholder) |
| Eliminar | `app/(platform)/peliculas/[id]/page.tsx` |
| Eliminar | `app/(platform)/peliculas/coleccion/[slug]/page.tsx` |
| Modificar | `components/layout/navbar.tsx` |
| Modificar | `components/features/detail/movie-detail.tsx` |
| Modificar | `components/features/catalog/catalog-screen.tsx` |
| Modificar | `components/features/space/my-space-screen.tsx` |
| Modificar | `components/features/player/player-screen.tsx` |
| Modificar | `components/features/search/search-screen.tsx` |
| Modificar | `components/features/home/home-screen.tsx` |

---

### Task 1: Crear ruta `/cortos` — catálogo principal

**Files:**
- Create: `app/(platform)/cortos/page.tsx`

- [ ] **Step 1: Crear `app/(platform)/cortos/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { getPeliculas, getColecciones } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Cortometrajes" };
export const revalidate = 60;

export default async function CortosPage() {
  const [items, colecciones] = await Promise.all([getPeliculas(), getColecciones()]);
  return (
    <Suspense>
      <CatalogScreen items={items} heading="Cortometrajes" colecciones={colecciones} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Abrir `http://localhost:3000/cortos` — debe mostrar el catálogo de cortometrajes idéntico al que antes estaba en `/peliculas`.

---

### Task 2: Crear ruta `/cortos/[id]` — detalle de corto

**Files:**
- Create: `app/(platform)/cortos/[id]/page.tsx`

- [ ] **Step 1: Crear `app/(platform)/cortos/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import { getPeliculaBySlug, getRelatedPeliculas } from "@/lib/supabase/queries";

export const revalidate = 3600;

interface Props {
  params: { id: string };
  searchParams: { valorar?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getPeliculaBySlug(params.id);
  return { title: movie?.title ?? "Cortometraje" };
}

export default async function CortoDetailPage({ params, searchParams }: Props) {
  const movie = await getPeliculaBySlug(params.id);
  if (!movie) notFound();

  const related = await getRelatedPeliculas(movie.id, movie.categories, 4, {
    author: movie.author,
    year: movie.year,
  });

  return (
    <MovieDetail
      movie={movie}
      related={related}
      autoOpenRating={searchParams.valorar === "1"}
    />
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Abrir `http://localhost:3000/cortos/<slug-de-cualquier-corto>` — debe mostrar la página de detalle correctamente.

---

### Task 3: Crear ruta `/cortos/coleccion/[slug]`

**Files:**
- Create: `app/(platform)/cortos/coleccion/[slug]/page.tsx`

- [ ] **Step 1: Crear `app/(platform)/cortos/coleccion/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { getColeccionBySlug, getPeliculasByColeccion } from "@/lib/supabase/queries";

export const revalidate = 60;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const col = await getColeccionBySlug(params.slug);
  return { title: col?.name ?? "Colección" };
}

export default async function ColeccionPage({ params }: Props) {
  const [col, items] = await Promise.all([
    getColeccionBySlug(params.slug),
    getPeliculasByColeccion(params.slug),
  ]);

  if (!col) notFound();

  return (
    <Suspense>
      <CatalogScreen items={items} heading={col.name} backHref="/cortos" />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Abrir `http://localhost:3000/cortos/coleccion/<slug-de-coleccion>` — debe mostrar la colección con el botón "volver" apuntando a `/cortos`.

---

### Task 4: Crear placeholder `/peliculas` y eliminar rutas antiguas

**Files:**
- Create: `app/(platform)/peliculas/page.tsx` (reemplazar contenido actual)
- Delete: `app/(platform)/peliculas/[id]/page.tsx`
- Delete: `app/(platform)/peliculas/coleccion/[slug]/page.tsx`

- [ ] **Step 1: Reemplazar `app/(platform)/peliculas/page.tsx` con el placeholder**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Películas" };

export default function PeliculasPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#22B16B]">
        Próximamente
      </span>
      <h1 className="text-[32px] font-extrabold text-white">Películas</h1>
      <p className="max-w-[400px] text-[15px] leading-relaxed text-[#6D7D94]">
        Estamos preparando una selección de largometrajes. Vuelve pronto.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Eliminar `app/(platform)/peliculas/[id]/page.tsx`**

Borrar el archivo. La ruta `/peliculas/<slug>` devolverá 404, lo cual es correcto — el contenido está en `/cortos/<slug>`.

- [ ] **Step 3: Eliminar `app/(platform)/peliculas/coleccion/[slug]/page.tsx`**

Borrar el archivo y el directorio `coleccion/` si queda vacío.

- [ ] **Step 4: Verificar en navegador**

- `http://localhost:3000/peliculas` → debe mostrar la pantalla "Próximamente"
- `http://localhost:3000/peliculas/cualquier-slug` → debe devolver 404

---

### Task 5: Actualizar navbar

**Files:**
- Modify: `components/layout/navbar.tsx`

- [ ] **Step 1: Actualizar `NAV_ITEMS` en `components/layout/navbar.tsx`**

Reemplazar el bloque `NAV_ITEMS` (líneas 24-28):

```tsx
const NAV_ITEMS: readonly NavItem[] = [
  { id: "home",    label: "Home",       href: "/inicio",     match: "/inicio" },
  { id: "cortos",  label: "Cortos",     href: "/cortos",     match: "/cortos" },
  { id: "movies",  label: "Películas",  href: "/peliculas",  match: "/peliculas" },
  { id: "space",   label: "Mi Espacio", href: "/mi-espacio", match: "/mi-espacio" },
];
```

- [ ] **Step 2: Verificar en navegador**

- El navbar debe mostrar 4 tabs: Home, Cortos, Películas, Mi Espacio
- La píldora verde debe deslizarse correctamente al navegar entre tabs
- "Cortos" activa al estar en `/cortos`, "Películas" activa al estar en `/peliculas`

---

### Task 6: Actualizar links internos — `movie-detail.tsx`

**Files:**
- Modify: `components/features/detail/movie-detail.tsx:30,50`

- [ ] **Step 1: Cambiar `backHref` (línea 30)**

```tsx
// Antes
<Hero item={movie} onPlay={() => router.push(`/ver/${movie.id}`)} onAddList={toggleList} inList={inList} backHref="/peliculas" />

// Después
<Hero item={movie} onPlay={() => router.push(`/ver/${movie.id}`)} onAddList={toggleList} inList={inList} backHref="/cortos" />
```

- [ ] **Step 2: Cambiar `onNavigate` (línea 50)**

```tsx
// Antes
onNavigate={(id) => router.push(`/peliculas/${id}`)}

// Después
onNavigate={(id) => router.push(`/cortos/${id}`)}
```

- [ ] **Step 3: Verificar**

Abrir el detalle de un corto desde `/cortos/<slug>`. El botón "volver" debe llevar a `/cortos`. Hacer clic en un relacionado debe navegar a `/cortos/<id>`.

---

### Task 7: Actualizar links internos — `catalog-screen.tsx`

**Files:**
- Modify: `components/features/catalog/catalog-screen.tsx:285,323,349`

- [ ] **Step 1: Cambiar href en sección de cortos (línea ~285)**

```tsx
// Antes
href={`/peliculas/${item.id}`}

// Después
href={`/cortos/${item.id}`}
```

- [ ] **Step 2: Cambiar href en sección de películas (línea ~323)**

```tsx
// Antes (dentro de filteredPeliculas.map)
href={`/peliculas/${item.id}`}

// Después
href={`/cortos/${item.id}`}
```

- [ ] **Step 3: Cambiar href de ColeccionCard (línea ~349)**

```tsx
// Antes
href={`/peliculas/coleccion/${col.slug}`}

// Después
href={`/cortos/coleccion/${col.slug}`}
```

- [ ] **Step 4: Verificar**

En `/cortos`, hacer clic en un corto del catálogo — debe navegar a `/cortos/<slug>`. Hacer clic en una colección — debe navegar a `/cortos/coleccion/<slug>`.

---

### Task 8: Actualizar links internos — `my-space-screen.tsx`

**Files:**
- Modify: `components/features/space/my-space-screen.tsx:482,495,526,549`

- [ ] **Step 1: Cambiar las 4 referencias a `/peliculas`**

Línea ~482:
```tsx
// Antes
onCta={() => router.push("/peliculas")}
// Después
onCta={() => router.push("/cortos")}
```

Línea ~495:
```tsx
// Antes
onDetail={() => router.push(`/peliculas/${item.id}`)}
// Después
onDetail={() => router.push(`/cortos/${item.id}`)}
```

Línea ~526:
```tsx
// Antes
onNavigate={() => router.push(`/peliculas/${item.id}`)}
// Después
onNavigate={() => router.push(`/cortos/${item.id}`)}
```

Línea ~549:
```tsx
// Antes
onClick={() => router.push(`/peliculas?genre=${encodeURIComponent(g)}`)}
// Después
onClick={() => router.push(`/cortos?genre=${encodeURIComponent(g)}`)}
```

- [ ] **Step 2: Verificar**

En `/mi-espacio`, hacer clic en un corto guardado — debe navegar a `/cortos/<slug>`. El CTA vacío debe llevar a `/cortos`.

---

### Task 9: Actualizar links internos — `player-screen.tsx`, `search-screen.tsx`, `home-screen.tsx`

**Files:**
- Modify: `components/features/player/player-screen.tsx:859`
- Modify: `components/features/search/search-screen.tsx:176,216,267,290`
- Modify: `components/features/home/home-screen.tsx:24`

- [ ] **Step 1: `player-screen.tsx` línea ~859**

```tsx
// Antes
router.push(`/peliculas/${item.id}?valorar=1`);
// Después
router.push(`/cortos/${item.id}?valorar=1`);
```

- [ ] **Step 2: `search-screen.tsx` — 4 referencias**

Líneas ~176 y ~216 y ~290 (hrefs a detalle de corto):
```tsx
// Antes
router.push(`/peliculas/${item.id}`)   // y también href={`/peliculas/${item.id}`}
// Después
router.push(`/cortos/${item.id}`)      // y también href={`/cortos/${item.id}`}
```

Línea ~267 (filtro por género):
```tsx
// Antes
router.push(`/peliculas?genre=${encodeURIComponent(g)}`)
// Después
router.push(`/cortos?genre=${encodeURIComponent(g)}`)
```

- [ ] **Step 3: `home-screen.tsx` línea ~24**

```tsx
// Antes
return `/peliculas/${item.id}`;
// Después
return `/cortos/${item.id}`;
```

- [ ] **Step 4: Verificar flujo completo**

1. Desde Home, hacer clic en un corto → debe ir a `/cortos/<slug>`
2. Desde el buscador, hacer clic en un resultado → debe ir a `/cortos/<slug>`
3. Desde el reproductor `/ver/<slug>`, al terminar → debe ir a `/cortos/<slug>?valorar=1`

---

### Task 10: Verificación final

- [ ] **Step 1: Comprobar que no queda ninguna referencia de ruta a `/peliculas` en componentes**

Buscar en el código (excluyendo `three-d-marquee.tsx` que contiene URLs de CDN):

```
grep -r '"/peliculas' streaming-app/components streaming-app/app --include="*.tsx" --include="*.ts"
```

El único resultado válido debe ser el navbar (`href: "/peliculas"` para la nueva tab de Películas).

- [ ] **Step 2: Navegación completa end-to-end**

Recorrer este flujo en `http://localhost:3000`:
1. Home → hacer clic en corto → `/cortos/<slug>` ✓
2. Navbar "Cortos" → `/cortos` ✓
3. Navbar "Películas" → `/peliculas` (placeholder "Próximamente") ✓
4. Desde `/cortos`, clic en colección → `/cortos/coleccion/<slug>` ✓
5. Desde `/cortos/coleccion/<slug>`, botón volver → `/cortos` ✓
6. Buscador → resultado → `/cortos/<slug>` ✓
7. `/mi-espacio` → clic en guardado → `/cortos/<slug>` ✓
