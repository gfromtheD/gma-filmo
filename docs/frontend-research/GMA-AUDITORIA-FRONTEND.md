# GMA Filmo — auditoría del frontend (Windows, rama `feature/frontend-windows`)

> Fecha: 2026-10-13. Base: `main` @ `41494c6` + 3 commits propios. Sin cambios de código en esta auditoría.
> Esta versión **no** incluye el motor multimedia del Mac; Studio y Player se auditan
> solo como contexto y no se tocan.

**Clasificación:** `PC` problema comprobado · `RR` riesgo razonable que requiere prueba ·
`PV` preferencia visual · `OP` oportunidad de optimización.

## 0. Stack real (leído de `node_modules`)

Next 14.2.35 (App Router) · React 18.3.1 · Tailwind 4.3.0 · Motion 12.40.0 · Radix UI 1.4.3 ·
Zustand 5.0.13 · Supabase JS 2.x. `tsc --noEmit` limpio; `next lint` sin errores y con 4
avisos previos (hooks/`<img>` en Studio, Player y DM).

## 1. Distribución de layouts

- `app/(platform)/layout.tsx` → `AppShell` (`min-h-screen bg-black`) → `Navbar` + `<main>` + `DMWindow`.
- Navbar: `header.sticky top-0 z-50` con degradado a transparente y `backdrop-blur`; rejilla
  `1fr auto 1fr`, alto fijo 80 px, `px-8`, `max-w-[1440px]`.
- Contenedor de contenido repetido a mano (`mx-auto max-w-[1440px] px-8`) en varias pantallas
  (p. ej. `home-screen.tsx`): no hay componente de contenedor compartido.

## 2. Hallazgos

### Responsive (mayor impacto)

| ID | Tipo | Hallazgo | Evidencia |
|---|---|---|---|
| R1 | PC | **No hay breakpoints responsive** en `layout`, `home`, `media/hero`, `detail`, `ratings`, `catalog`, `search`, `studio`, `player`; solo 6 de 21 archivos de `components/ui` los usan. | `grep` de prefijos `sm|md|lg|xl:` por carpeta. |
| R2 | PC | La navbar mantiene **767 px de ancho** en cualquier viewport. En 390/430 px quedan fuera de pantalla «Cortos», «Mi Espacio», Buscador y Cuenta; en 320/360 px también «Películas». En móvil el usuario **no puede llegar** al buscador ni a su cuenta. | Playwright, `/inicio`, `/peliculas`, `/cortos`; captura 390 px. |
| R3 | PC | A 390 px el eslogan «el cine es nuestro» se parte en dos líneas y se solapa con la píldora; la etiqueta «CORTO · DESTACADO» se solapa con la ilustración del hero. | Captura 390 px. |
| R4 | RR | En `RatingsBlock`, la fila de puntuación (`flex gap-7`, número de 52 px + separador + texto + botón) y la rejilla de 10 botones del modal (`flex-1`) quedan por debajo de 44 px de ancho táctil en ≤390 px. | Código; **falta prueba visual**. |
| R5 | RR | `Carousel` desplaza siempre 600 px (`scrollBy`), con `gap` fijo de 14 px; en móvil salta más de una pantalla. Las flechas no se deshabilitan en los extremos. `scroll-snap-type` está en el contenedor pero no se verificó `scroll-snap-align` en los hijos. | `components/ui/carousel.tsx`. |
| R6 | RR | Sub-navegación de Studio (`isStudioNav`) se coloca con `position:absolute; top:100%; margin-top:20px` bajo la píldora; en pantallas estrechas se saldrá de la cabecera. | Código. Área sensible (Studio). |

### Accesibilidad

| ID | Tipo | Hallazgo | Evidencia |
|---|---|---|---|
| A1 | PC | La píldora «Mi Espacio / Mi Estudio» para creadores es un `<div onClick>` sin `role`, `tabIndex` ni teclado: **no es operable con teclado**. | `navbar.tsx:290-311`. |
| A2 | PC | Menú de cuenta: `aria-expanded` sí; **sin Escape**, sin `aria-haspopup`/`role=menu`, sin gestión de foco. Cierre solo por `mousedown` externo. | `navbar.tsx:169-177, 404-410`. |
| A3 | PC | `<nav>` sin `aria-label`; enlace activo sin `aria-current="page"`. | `navbar.tsx:272, 316-324`. |
| A4 | PC | **Cero soporte de `prefers-reduced-motion`** en toda la app (`app`, `components`, `hooks`). Hay rotación de ruleta, deslizamientos, clip-path y hero automático. | `grep` sin resultados. |
| A5 | PC | El hero avanza solo cada 6 s; pausa únicamente con *hover* (no existe en táctil) y sin botón de pausa (WCAG 2.2.2). | `home-screen.tsx:17, 58-62`. |
| A6 | PC | `RatingModal`: sin `role="dialog"`/`aria-modal`, sin focus trap ni Escape; el «checkbox» es un `<span role=checkbox>` sin `preventDefault` en Espacio. | `ratings-block.tsx:279-392`. |
| A7 | PC | Contraste (WCAG, texto pequeño ≥ 4,5:1): `#4A5568` sobre `#0D0D0D` = **2,58:1**, sobre negro 2,79:1 (estado «Cargando…», estado vacío, fecha, ayuda de escala); `#5A6A7E` = **3,51:1** (correo/subtexto del menú). `#6D7D94` = 4,64:1 pasa por poco. | Cálculo WCAG sobre la paleta. |

### Mantenibilidad y rendimiento

| ID | Tipo | Hallazgo | Evidencia |
|---|---|---|---|
| M1 | PC | Hay tokens (`--gma-*`, `bg-gma-*`) pero casi no se usan: **1.047 literales hex en 51 archivos** frente a **9 usos** de utilidades de token. El verde `#22B16B` aparece 250 veces. | `grep` en `components` y `app`. |
| M2 | PC | `navbar.tsx` (566 líneas) mezcla navegación, avatar, ruleta, sub-nav de Studio, menú de cuenta, cierre de sesión y apertura de DM; importa `STUDIO_TABS` desde `features/studio` (acoplamiento con zona sensible). | Código. |
| M3 | RR | La posición de la píldora activa (`offsetLeft/offsetWidth`) solo se recalcula al cambiar `pathname`; no al redimensionar, hacer zoom o cargar la fuente → posible desalineación. Dependencias de efecto deshabilitadas con `eslint-disable`. | `navbar.tsx:222-231`; **falta prueba**. |
| M4 | RR | `setTimeout(() => router.push(...), 420)` sin limpieza al desmontar; medición de `chipPos` en cada `resize` sin limitar. | `navbar.tsx:212, 219, 122-132`. |
| M5 | OP | Logo y avatares con `<img>` (aviso de lint suprimido) y sin dimensiones intrínsecas → riesgo de CLS. | `navbar.tsx:39, 255`. |
| M6 | OP | Contenedores `mx-auto max-w-[1440px] px-8` duplicados; candidatos a un único contenedor con padding responsive. | `home-screen.tsx:166` y otros. |
| M7 | PV | Estilos mezclados: `style={{…}}` inline con Tailwind en la misma pieza (ruleta, sub-nav, chip de cuenta). | `navbar.tsx`. |
| M8 | — | Archivos grandes (no se tocan): `player-screen.tsx` 1.985 líneas, `studio-upload-orbital.tsx` 927. | `wc -l`. |

## 3. Valoraciones — contrato actual (se respeta íntegro)

- Componente: `RatingsBlock({ title, numericId, autoOpen? })`, consumido solo en `movie-detail.tsx`.
- Datos: `useRatings()` (`getRating`, `setRating(id, score/2, comentario)`), `useCommunityRatings(id, refreshKey)` →
  `{ reviews, avgScore, voteCount, loading }`; `CommunityReview = { userId, displayName, avatarUrl,
  avatarColor, score, comment, ratedAt, likeCount, likedByMe }`.
- Escritura: `/api/ratings` (+ `/api/ratings/community`, `/like`). **No se modifica.**
- Escala: entero 1–10 (distinta de la escala 0–10 observada en Filmin).
- **No existen** en los datos: distribución por nota, orden, paginación. Cualquier
  histograma/orden requeriría una nueva función de backend → **solo propuesta, con tu autorización**.
  Con los datos actuales sí se puede calcular una distribución *en cliente* a partir de `reviews`,
  pero solo de las reseñas devueltas; no es la distribución real de todos los votos.
- Aparece además una pestaña «Comentarios» (sistema aparte) en `movie-detail`.

## 4. Zonas de bajo y alto riesgo para esta etapa

- **Seguras (visual):** `components/layout/*`, `components/ui/*`, `home`, `catalog`, `detail`, `ratings`, `search`, tokens y CSS global.
- **Sensibles (no tocar sin petición expresa):** `studio`, `player`, `dm` (lógica), APIs, `lib/supabase`, `lib/r2`, migraciones.
- La navbar importa de Studio solo una constante (`STUDIO_TABS`); la Fase B debe mantener ese
  import tal cual y no tocar `studio-sub-nav.tsx`.
