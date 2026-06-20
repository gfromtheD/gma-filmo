# Design: Migración /peliculas → /cortos + nueva pestaña Películas

**Fecha:** 2026-06-13  
**Estado:** Aprobado

## Resumen

La ruta `/peliculas` actualmente contiene los cortometrajes. Se renombra a `/cortos` para reflejar su contenido real. Se crea una nueva ruta `/peliculas` como placeholder para largometrajes, y se añade una cuarta pestaña "Películas" al navbar.

## Cambios de rutas

| Ruta actual | Nueva ruta | Notas |
|---|---|---|
| `/peliculas` | `/cortos` | Catálogo de cortometrajes |
| `/peliculas/[id]` | `/cortos/[id]` | Detalle de cortometraje |
| `/peliculas/coleccion/[slug]` | `/cortos/coleccion/[slug]` | Catálogo por colección |
| — | `/peliculas` | Nueva — placeholder largometrajes |

## Navbar

Orden final de tabs en `NAV_ITEMS`:

1. Home → `/inicio`
2. Cortos → `/cortos`
3. Películas → `/peliculas`
4. Mi Espacio → `/mi-espacio`

El `match` de cada item se actualiza en consecuencia para que la píldora deslizante funcione correctamente.

## Archivos a crear (nuevos)

- `app/(platform)/cortos/page.tsx` — copia de `peliculas/page.tsx`, heading "Cortometrajes"
- `app/(platform)/cortos/[id]/page.tsx` — copia de `peliculas/[id]/page.tsx`
- `app/(platform)/cortos/coleccion/[slug]/page.tsx` — copia de `peliculas/coleccion/[slug]/page.tsx`, `backHref="/cortos"`
- `app/(platform)/peliculas/page.tsx` — página placeholder "Próximamente"

## Archivos a eliminar

- `app/(platform)/peliculas/page.tsx` (reemplazado por el placeholder)
- `app/(platform)/peliculas/[id]/page.tsx`
- `app/(platform)/peliculas/coleccion/[slug]/page.tsx`

## Links internos a migrar (`/peliculas` → `/cortos`)

| Archivo | Cambio |
|---|---|
| `components/layout/navbar.tsx` | href y match de Cortos; añadir item Películas |
| `components/features/detail/movie-detail.tsx` | `backHref="/peliculas"` → `/cortos`; `router.push('/peliculas/${id}')` → `/cortos/${id}` |
| `components/features/catalog/catalog-screen.tsx` | 3 hrefs: `/peliculas/${id}` → `/cortos/${id}`, `/peliculas/coleccion/${slug}` → `/cortos/coleccion/${slug}` |
| `components/features/space/my-space-screen.tsx` | 4 refs: `/peliculas` → `/cortos`, `/peliculas/${id}` → `/cortos/${id}` |
| `components/features/player/player-screen.tsx` | `router.push('/peliculas/${id}?valorar=1')` → `/cortos/${id}?valorar=1` |
| `components/features/search/search-screen.tsx` | 4 refs: `/peliculas/${id}` → `/cortos/${id}`, `/peliculas?genre=` → `/cortos?genre=` |
| `components/features/home/home-screen.tsx` | template literal `/peliculas/${id}` → `/cortos/${id}` |

## Página placeholder `/peliculas`

Pantalla sencilla con mensaje "Próximamente" en el estilo visual de la app (fondo oscuro, texto en verde `#22B16B`). Sin lógica de datos — estática.

## Lo que NO cambia

- URLs de R2/CDN en `three-d-marquee.tsx` — son rutas de almacenamiento, no rutas de navegación.
- Lógica de queries, tipos, base de datos — sin cambios.
- Nombres de funciones (`getPeliculas`, `getPeliculaBySlug`, etc.) — se mantienen igual.
