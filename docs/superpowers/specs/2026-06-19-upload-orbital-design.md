# Upload Orbital — Spec (2026-06-19)

## Contexto

La pestaña "Subir" de Mi Estudio tiene un wizard de 3 pasos: Archivo → Detalles → Vista previa.
El Step 0 ("Archivo") usa actualmente un clásico drag-drop box. Este spec reemplaza ese bloque por un menú orbital interactivo que permite gestionar todos los assets de un título desde una sola vista.

## Objetivo

Sustituir el Step 0 del wizard por un componente `UploadOrbital` que:
- Presenta el upload del archivo principal (película/corto) en el nodo central
- Muestra 5 nodos orbitales para assets complementarios
- Indica visualmente qué assets están subidos y cuáles faltan
- Permite al usuario subir cada asset de forma independiente y en cualquier orden
- Habilita el botón "Continuar" del wizard solo cuando el archivo principal está listo

## Archivos afectados

| Acción | Archivo |
|--------|---------|
| Crear | `components/features/studio/studio-upload-orbital.tsx` |
| Modificar | `components/features/studio/studio-upload-view.tsx` (Step 0 únicamente) |

## Nodos

| ID | Label | Icono Lucide | Formatos aceptados | Posición |
|----|-------|--------------|--------------------|----------|
| `main` | Película / Corto | `Film` | .mp4 .mov — hasta 8 GB | Centro |
| `trailer` | Tráiler | `Play` | .mp4 .mov | Orbital 1 |
| `subtitles` | Subtítulos | `Captions` | .srt .vtt | Orbital 2 |
| `extras` | Extras / Making of | `Clapperboard` | .mp4 .mov | Orbital 3 |
| `intro` | Intro animada | `Sparkles` | .mp4 .webm | Orbital 4 |
| `poster` | Póster | `Image` | .jpg .png .webp | Orbital 5 |

## Estado por nodo

```ts
type NodeState = "idle" | "uploading" | "done";

interface NodeData {
  state: NodeState;
  file: { name: string; size: string } | null;
  progress: number; // 0-100
}
```

Cada nodo tiene su propio timer de simulación independiente.

## Comportamiento visual

### Nodo central (`main`)
- Círculo 72px, gradiente `purple → blue → teal`, anillos de `animate-ping`
- Estado idle: anillo interior blanco pulsante (`animate-pulse`)
- Drag-drop: arrastrar vídeo encima cambia el borde a accent y activa la subida
- Click: abre `<input type="file" accept="video/mp4,video/quicktime">` nativo (hidden)
- Subiendo: anillo de progreso circular SVG alrededor del círculo
- Done: fondo `C.accent` (#22B16B), icono `Check` blanco

### Nodos orbitales
- Círculo 40px, radio de órbita 170px, 5 nodos equidistantes (72° de separación)
- **Rotación**: auto-rotate 0.3°/tick a 50ms cuando `autoRotate = true`
- La rotación se pausa cuando `activeNodeId !== null`
- Opacidad variable según posición en órbita (0.4–1.0), igual que el componente referencia
- Estados:
  - `idle`: fondo oscuro `C.w4`, borde `white/40`, opacidad variable por posición
  - `uploading`: borde blanco `animate-pulse`
  - `done`: fondo `C.accent`, borde verde, opacidad fija 1.0
  - `active` (expandido): escala 1.5×, fondo blanco, icono negro

### Tarjeta flotante (click en nodo orbital)
- Aparece encima del nodo si `y > 0` (mitad inferior), debajo si `y < 0`
- `bg-black/90 backdrop-blur-lg border border-white/30 rounded-2xl`
- Ancho: 220px
- Contenido según estado:
  - **idle**: nombre del asset, formatos aceptados, botón "Subir archivo" (click → `<input type="file">` hidden)
  - **uploading**: nombre del archivo, barra de progreso, porcentaje
  - **done**: nombre del archivo, tamaño, badge "Completo", botón "Quitar"
- Click fuera del orbital → cierra tarjeta y reanuda rotación

### Indicador de completitud (bajo el orbital)
- 5 puntos (uno por nodo orbital), verde si `done`, gris si `idle` o `uploading`
- Texto: `"N de 5 assets completados"`
- Nota: `"No obligatorio · mejora la experiencia del espectador"`

## Sizing

- Contenedor del orbital: `560px` alto, `100%` ancho, centrado con `position: relative`
- Sin `h-screen`, sin `overflow-hidden`
- Radio órbita: `170px`
- Centro del SVG/transform: `(0, 0)` relativo al centro del contenedor con `position: absolute` + `translate(-50%, -50%)`

## Integración con UploadView

```tsx
// En UploadView, Step 0 pasa de:
{!file ? <DropZone /> : <ProgressCard />}

// A:
<UploadOrbital onMainReady={(f) => setFile(f)} />
```

- `onMainReady` se llama cuando el nodo `main` llega a `state === "done"`
- `canNext` en Step 0: `!!file` (sin cambios en la lógica del padre)
- Steps 1 y 2 no se modifican

## Simulación de subida (mock)

```ts
// Por cada nodo al seleccionar archivo:
const timer = setInterval(() => {
  setProgress(p => {
    if (p >= 100) { clearInterval(timer); return 100; }
    return Math.min(100, p + Math.random() * 14 + 4);
  });
}, 320);
```

## Estilos

El componente usa el mismo sistema de tokens del studio (`C.*` de `studio-ui.tsx`) para consistencia.
Las clases Tailwind de animación (`animate-pulse`, `animate-ping`, `transition-all`) se aplican igual que en el componente referencia. No se añade CSS global nuevo.

## Lo que NO cambia

- Steps 1 (Detalles) y 2 (Vista previa) de `UploadView`
- Toda la lógica de formulario (`FormState`, `form`, `set`)
- El stepper visual (`STEPS`, navegación entre pasos)
- Los componentes auxiliares (`Field`, `Chip`, `Poster`)
- `studio-types.ts`, `studio-data.ts`, `studio-ui.tsx`
