# Filmin — observaciones (investigación interna)

> Fecha: 2026-10-13. Fuente: páginas públicas de https://www.filmin.es/.
> Uso: entender patrones de UX de una plataforma consolidada. **No** se copia código,
> textos, identidad visual ni imágenes. Las capturas de referencia están fuera del
> repositorio (`GMA/_research-filmin/`) y no deben publicarse.

## Método y limitaciones

- **Herramientas:** REA 6.4.0 (inspección pasiva por CDP, árbol de accesibilidad, DOM,
  consola, captura) sobre un Chrome aislado con perfil temporal y depuración solo en
  `127.0.0.1:9333`; Chrome DevTools MCP para medir CSS calculado y scroll.
- **Sin** credenciales, cookies personales ni rastreo masivo. No se evita ningún control
  de acceso, pago ni DRM. Páginas visitadas: portada y una ficha pública.
- **Limitación 1 (sesión):** el perfil del navegador de DevTools tenía una sesión
  previa de Filmin. No se leyó ni se registró ningún dato personal y no se pulsó ningún
  control de valoración. Lo que depende de sesión se repitió en un contexto limpio
  (`visitante-limpio`) y se indica explícitamente.
- **Limitación 2 (viewport):** emulando móvil 390 px, `innerWidth` informó 400 px. En
  `localhost` el perfil aplica además zoom 90 %; por eso las medidas de GMA se hicieron con
  Playwright (viewport exacto).
- **Limitación 3:** navegación headless; las comprobaciones de cierre con Escape y clic
  exterior usaron eventos sintéticos. No se probó teclado real (Tab), hover de tarjetas,
  overlay del buscador ni apertura del panel móvil.
- Los valores son de una sola observación; Filmin puede cambiar.

Leyenda: **[OBS]** observado directamente · **[INF]** inferido · **[PROP]** propuesta de GMA.

---

## A. Navegación superior

| Aspecto | Evidencia |
|---|---|
| Estructura | **[OBS]** `<header>` (role banner) con `<nav>`: logo, Inicio, Cine, Series, Colecciones, Festivales, botón «Más» (`aria-haspopup="menu"`, expandible), botón Buscar, CTA «Suscribirse» e «Iniciar sesión». URL: `/`. Viewport 1440. |
| Posicionamiento | **[OBS]** contenedor `.layout__header` con `position: sticky; top: 0; z-index: 1022`. El `<header>` interior es `relative`. A scrollY 300/1200/1000 sigue en `top: 0`. |
| Estado en scroll | **[OBS]** en scrollY 0 la clase `is-transparent` mantiene fondo transparente; al desplazarse pasa a fondo sólido `rgb(6,6,19)`; vuelve a transparente al regresar a 0. Transición 0,3 s `cubic-bezier(.4,0,1,1)` sobre colores. Umbral exacto no medido (entre 0 y 300 px). |
| Medidas desktop | **[OBS]** alto 64 px (66 px en otras mediciones), padding horizontal 64 px. Enlaces 16 px / peso 400; botones de acción 14 px / 800 / mayúsculas, alto 32 px; icono buscar 24×24. |
| Anchos 1024–1920 | **[OBS]** misma barra de escritorio completa a 1024, 1280, 1440 y 1920; sin hamburguesa en 1024. |
| Móvil (390 → 400 px) | **[OBS]** alto 56 px, padding 16 px. Controles: botón «Abrir el menú principal» (24 px), logo (64×18), Buscar (24), «Tu Filmin» (24), CTA 120×32. Existe un panel con «Cerrar el menú principal» e ítems de 57 px de alto y 288 px de ancho. **[NO VERIFICADO]** animación y comportamiento al abrirlo. |
| Menú «Más» | **[OBS]** alterna `aria-expanded` true/false; se cierra con Escape y con clic exterior (eventos sintéticos). No se localizó `role=menu` en el DOM tras abrirlo. |
| Hover/focus/active | **[NO VERIFICADO]** |

**Patrón aplicable a GMA:** barra sticky con transición de fondo en scroll; jerarquía
clara entre navegación principal y acciones de usuario; cambio de patrón (no escalado
proporcional) en móvil con menú lateral. **[PROP]** ver `PLAN-REDISENO.md`.

## B. Página de inicio

URL `/`, viewports 1024/1280/1440/1920 y 390.

- **[OBS]** Bloques: hero con slider (`role=group`, `roledescription=slide`, región
  `aria-live=polite`), seguido de ~16 filas horizontales; cada fila tiene títulos,
  botones «Anterior/Siguiente» (deshabilitados en los extremos) y pie con enlaces.
- **[OBS]** Cada fila es un contenedor `c-row c-row--scroll` con `scroll-snap-type: x mandatory`,
  `scroll-behavior: smooth`, `scrollbar-width: none`, `padding-inline: 56 px` y
  `scroll-padding: 56 px`; cada tarjeta lleva `8 px` de relleno derecho (separación
  efectiva 8 px + 8 px de la siguiente). Imágenes `object-fit: cover`, `loading=lazy`,
  con `srcset`, radio 0.
- **[OBS]** Tres formatos de fila: póster 2:3 (208×312 a 1920), apaisada 16:9 (343×193 a
  1920) y vertical alta ~1:2 (343×686 a 1920).
- **[OBS]** El ancho de tarjeta es `(ancho útil − 2×56) / N` con N por tramo:

| Viewport (ancho útil) | Póster 2:3 | Apaisada 16:9 | Alta 1:2 |
|---|---|---|---|
| 1920 (1905) | 224 px · 8 visibles | 359 px · 5 | 359 px · 5 |
| 1440 (1425) | 219 px · 6 + avance | ~328–438 px | 328 px · 5 |
| 1280 (1265) | 192 px · 6 | 288 px · 4 | 288 px · 4 |
| 1024 (1009) | 149 px · 6 | 299 px · 3 | 299 px · 3 |
| 390 (400) | pad 12 px · 2 + avance | 188 px · 2 + avance | 188 px · 2 + avance |

- **[OBS]** El primer elemento de cada fila (56 px) no se alinea con el logo (64 px): 8 px
  de desfase en escritorio; en móvil 12 px frente a 16 px.
- **[OBS]** Consola: aviso de Hotjar por user-agent headless (no relevante).
- **[NO VERIFICADO]** hover de tarjetas, skeletons, comportamiento al redimensionar de
  forma continua.

**Patrón aplicable:** composición por columnas por tramo con `peek` de la siguiente
tarjeta, snap CSS y flechas que reflejan los extremos. **[PROP]** Carrusel CSS-first.

## C. Catálogo

**[OBS parcial]** Enlaces del menú: `/catalogo/peliculas`, `/catalogo/series`,
`/colecciones`, `/festivales`. **[NO VERIFICADO]** filtros, ordenación, cuadrículas y
estados: no se abrió ninguna página de listado en esta ronda.

## D. Ficha de película

URL `/pelicula/un-simple-accidente`, 1440 y 390.

- **[OBS]** Cabecera con imagen de fondo; `h1` en x=224, y≈530; puntuación visible
  como bloque «nota · número de votos · calificación verbal»; director y géneros como
  enlaces tipo chip.
- **[OBS]** Acciones (escritorio): CTA principal 322×56 + botón secundario 60×56; acciones
  terciarias «Guardar», «Valorar» y «Compartir» (alto 40). **Móvil:** CTA principal y
  «Ver tráiler» a ancho completo (368×56); acciones terciarias como icono+etiqueta de 64 px.
- **[OBS]** `tablist` real: **DETALLES · SIMILARES · VALORACIONES · EXTRAS**
  (`role=tab`, `aria-selected`, `<button>`, no enlaces), alto 59–60 px, con flechas de
  desplazamiento en ambos extremos (24 px). El estado se enlaza con hash
  (`#reviews`, el panel es `#reviews-tabcontent`). En móvil la pestaña se desplaza horizontalmente.
- **[OBS]** Panel DETALLES a 1440: dos columnas. Izquierda (x=104, 638 px): Sinopsis,
  Premios y nominaciones, Temas. Derecha (x=870, 419 px): Dirección y reparto, Audio y
  subtítulos, Más información.
- **[OBS]** Móvil: `h1` de 32 px; cabecera 56 px; sin desbordamiento horizontal.

## E. Valoraciones (prioridad alta)

URL `/pelicula/un-simple-accidente#reviews`.

**Visitante (contexto limpio) [OBS]:** cabecera con «Iniciar sesión», sin avatar; el panel
muestra el título de sección y las tarjetas; **0 controles de valoración**.

**Usuario con sesión (sesión previa del perfil; sin escritura) [OBS]:** encima de las
tarjetas aparece una invitación a valorar con una **escala 0–10**, una casilla grande por
valor y una etiqueta verbal debajo de cada una; se desplaza horizontalmente con una flecha
lateral. Se pide elegir nota antes de poder comentar.

**Tarjeta de valoración [OBS]:** `article.user-review-card`, 768 px de ancho y centrada en
una columna, fondo `rgb(36,36,50)`, radio 8 px, padding 24 px, separación 16 px. Cabecera:
avatar 45 px, nombre y alias; a la derecha una casilla con el número (outline, 12 px) y la
etiqueta verbal; después el comentario (`text-base`); al pie la fecha en mayúsculas.
24 tarjetas visibles a la vez. En móvil: 368 px de ancho, mismo padding y radio.

**No observado en esta ficha:** histograma de distribución, selector de orden, «cargar más»,
«ver más» en textos largos, estados vacío/carga. **No** se afirma que Filmin carezca de
ellos.

**Diferencias con GMA (ver `GMA-AUDITORIA-FRONTEND.md`):** GMA usa nota entera 1–10 (guardada
como `rating = nota/2`), muestra media y nº de votos, y añade «De acuerdo» por reseña.

**Adaptación original propuesta [PROP]:** ver `PLAN-REDISENO.md`, Fase E.
