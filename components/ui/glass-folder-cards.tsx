"use client"

import * as React from "react"

/**
 * Carpeta de cristal (basada en «Glass Folder Cards» de 21st.dev), adaptada a GMA Filmo.
 *
 * Tres capas, de atrás adelante: un panel trasero del color de la carpeta, las obras que contiene (sus portadas) y un
 * panel frontal de cristal esmerilado que desenfoca lo que hay detrás. Nada es una imagen de una carpeta: las portadas
 * son elementos reales entre dos paneles reales.
 *
 * - **Reposo**: plana y cerrada; solo asoma lo alto de las portadas.
 * - **Hover / foco**: el cristal se inclina hacia ti sobre su bisagra y las portadas suben un poco.
 * - **Abierta** (`open`): el cristal cae más y las portadas salen en abanico; al pasar el cursor por una, se levanta.
 *   Son solo para mirar: no se pueden pulsar ni llevan título.
 *
 * Es controlada: quien la usa decide si está abierta (`open`) y qué obras lleva (`files`). El color (`color`) tiñe el
 * panel trasero y el cristal; con cualquier tono el efecto de cristal líquido es el mismo.
 */

export type FolderFile = {
  name: string
  /** Portada. Sin ella, la obra es una hoja de papel con su título. */
  image?: string
}

export type GlassFolderProps = {
  label: string
  /** Segunda línea bajo el título: p. ej. «12 obras». */
  meta?: string
  /** Color de la carpeta, `#rrggbb`. */
  color?: string
  files?: FolderFile[]
  open?: boolean
  /** Pulsar la carpeta pide abrirla (`true`) o cerrarla (`false`). */
  onOpenChange?: (open: boolean) => void
  /** Ancho en px. Todo escala con él; el alto es 0,96 × ancho. */
  width?: number
  /** Se monta sola la primera vez que entra en pantalla. */
  appear?: boolean
  /** Retraso de esa entrada, en ms: para escalonar una fila de carpetas. */
  appearDelay?: number
  className?: string
}

/** Un número estable para una cadena: hace que cada portada se incline siempre igual. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** PRNG pequeño y rápido con semilla (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Dónde cae una portada en el abanico: -1 … 1 a lo largo de la pila visible, 0 si hay una. */
function fanSlot(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1
}

// Geometría, en unidades propias de la carpeta. El escenario se dibuja a 340 × 272 y se escala a `width`.
const W = 340
const H = 272
const HEADROOM = 54 // hueco sobre el panel trasero para que suban las portadas
const FRONT_H = H - 74
const SHEET_W = 272
const SHEET_H = 184
export const MAX_VISIBLE = 4

const BACK_PATH =
  "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z"
const FRONT_PATH =
  "M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 " +
  (FRONT_H - 22) +
  "A22 22 0 0 1 318 " +
  FRONT_H +
  "L22 " +
  FRONT_H +
  "A22 22 0 0 1 0 " +
  (FRONT_H - 22) +
  "Z"

export default function GlassFolder({
  label,
  meta,
  color = "#22B16B",
  files = [],
  open = false,
  onOpenChange,
  width = 340,
  appear = true,
  appearDelay = 0,
  className,
}: GlassFolderProps) {
  const uid = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const filesRef = React.useRef<HTMLDivElement>(null)
  const [entered, setEntered] = React.useState(!appear)

  const k = width / W
  // En carpetas pequeñas el texto se contrarresta para que siga siendo legible (todo el escenario escala con `width`).
  const labelZoom = Math.min(1.5, Math.max(1, 0.8 / k))

  // ---- entrada: la carpeta se monta la primera vez que está en pantalla ----
  React.useEffect(() => {
    if (!appear) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setEntered(true)
      return
    }
    let t = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        t = window.setTimeout(() => setEntered(true), appearDelay)
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      window.clearTimeout(t)
    }
  }, [appear, appearDelay])

  // ---- puntero: la luz y el paralaje siguen al cursor, sin re-renders ----
  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let raf = 0
    let px = 0
    let py = 0
    const write = () => {
      raf = 0
      el.style.setProperty("--gf-px", px.toFixed(3))
      el.style.setProperty("--gf-py", py.toFixed(3))
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return
      const r = el.getBoundingClientRect()
      px = ((e.clientX - r.left) / r.width) * 2 - 1
      py = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(write)
    }
    const leave = () => {
      px = 0
      py = 0
      if (!raf) raf = requestAnimationFrame(write)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", leave)
    return () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerleave", leave)
      cancelAnimationFrame(raf)
    }
  }, [])

  // ---- con la carpeta cerrada, sus portadas quedan fuera del orden de tabulación ----
  React.useEffect(() => {
    filesRef.current?.toggleAttribute("inert", !open)
  }, [open])

  // las más nuevas van al frente de la pila, junto al cristal
  const start = Math.max(0, files.length - MAX_VISIBLE)
  const visible = files.slice(start)
  const count = files.length

  return (
    <div
      ref={rootRef}
      className={"gf-root" + (className ? " " + className : "")}
      data-open={open || undefined}
      data-entered={entered || undefined}
      style={
        {
          width,
          height: (H + HEADROOM) * k,
          "--gf-color": color,
          "--gf-lz": labelZoom,
        } as React.CSSProperties
      }
    >
      <style>{GF_CSS}</style>
      <div className="gf-stage" style={{ transform: "translateY(" + HEADROOM * k + "px) scale(" + k + ")" }}>
        <div className="gf-tilt">
          <div className="gf-shadow" aria-hidden="true" />

          {/* panel trasero, del color de la carpeta */}
          <div className="gf-back" style={{ clipPath: "path('" + BACK_PATH + "')" }} aria-hidden="true">
            <div className="gf-back-sheen" />
          </div>
          <svg className="gf-rim gf-back-rim" viewBox={"0 0 " + W + " " + H} aria-hidden="true">
            <path d={BACK_PATH} />
          </svg>

          {/* el cristal frontal, con bisagra en su borde inferior */}
          <div className="gf-front" style={{ clipPath: "path('" + FRONT_PATH + "')" }}>
            <div className="gf-tint" aria-hidden="true" />
            <div className="gf-spec" aria-hidden="true" />
            <svg className="gf-rim gf-front-rim" viewBox={"0 0 " + W + " " + FRONT_H} aria-hidden="true">
              <defs>
                <linearGradient id={"gf-rim-" + uid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                  <stop offset="0.35" stopColor="#fff" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path d={FRONT_PATH} stroke={"url(#gf-rim-" + uid + ")"} />
            </svg>
            <button
              type="button"
              className="gf-hit"
              aria-expanded={open}
              aria-label={(open ? "Cerrar " : "Abrir ") + label + ", " + count + (count === 1 ? " obra" : " obras")}
              onClick={() => onOpenChange?.(!open)}
            />
            <div className="gf-label">
              <span className="gf-title">{label}</span>
              {meta ? <span className="gf-meta">{meta}</span> : null}
            </div>
          </div>

          {/* el contenido: tras el cristal en el orden de tabulación, bajo él en pantalla */}
          <div ref={filesRef} className="gf-files" role="list" aria-label={"Contenido de " + label}>
            {visible.map((file, v) => {
              const jitter = rng(hashString(file.name) + v)
              return (
                <div key={start + v + file.name} role="listitem" className="gf-sheet-slot">
                  <div
                    aria-label={file.name}
                    className={"gf-sheet" + (file.image ? " gf-sheet--art" : "")}
                    style={
                      {
                        "--gf-slot": fanSlot(v, visible.length),
                        "--gf-depth": visible.length - 1 - v,
                        "--gf-jx": ((jitter() - 0.5) * 10).toFixed(2) + "px",
                        "--gf-jr": ((jitter() - 0.5) * 3.2).toFixed(2) + "deg",
                        zIndex: v + 1,
                      } as React.CSSProperties
                    }
                  >
                    {file.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="gf-sheet-art" src={file.image} alt="" width={SHEET_W} height={SHEET_H} draggable={false} />
                    ) : (
                      <span className="gf-lines" aria-hidden="true">
                        <i style={{ width: "86%" }} />
                        <i style={{ width: "92%" }} />
                        <i style={{ width: "64%" }} />
                        <i style={{ width: "88%" }} />
                        <i style={{ width: "42%" }} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const GF_CSS = `
.gf-root {
  --gf-px: 0;
  --gf-py: 0;
  --gf-ease: cubic-bezier(.2, .8, .2, 1);
  --gf-spring: cubic-bezier(.34, 1.36, .5, 1);
  --gf-hinge: 0deg;
  --gf-lift: 42px;
  --gf-spread: 0px;
  --gf-fan: 0deg;
  --gf-stack: 15px;
  position: relative;
  display: inline-block;
  flex: none;
  vertical-align: top;
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  isolation: isolate;
}
.gf-root:hover, .gf-root:focus-within { --gf-hinge: -11deg; --gf-lift: -34px; --gf-spread: 8px; --gf-fan: 1.4deg; --gf-stack: 10px; }
.gf-root[data-open] { --gf-hinge: -24deg; --gf-lift: -96px; --gf-spread: 40px; --gf-fan: 5deg; --gf-stack: 30px; }

.gf-stage { position: absolute; left: 0; top: 0; width: 340px; height: 272px; transform-origin: 0 0; }
.gf-tilt {
  position: absolute;
  inset: 0;
  transform: perspective(1400px) rotateX(calc(var(--gf-py) * -3deg)) rotateY(calc(var(--gf-px) * 4deg));
  transition: transform .9s var(--gf-ease);
}

.gf-shadow {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -6px;
  height: 60px;
  border-radius: 40px;
  background: color-mix(in srgb, var(--gf-color) 55%, black);
  opacity: .5;
  filter: blur(22px);
  transform: translateX(calc(var(--gf-px) * -8px));
  transition: transform .9s var(--gf-ease), opacity .9s var(--gf-ease);
}

.gf-back {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--gf-color) 72%, white) 0%, var(--gf-color) 38%, color-mix(in srgb, var(--gf-color) 52%, black) 100%);
}
.gf-back-sheen {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .22) 0%, rgba(255, 255, 255, 0) 22%),
    radial-gradient(120% 80% at calc(80% + var(--gf-px) * -10%) 0%, rgba(255, 255, 255, .2), rgba(255, 255, 255, 0) 60%);
  pointer-events: none;
}
.gf-rim { position: absolute; left: 0; top: 0; max-width: none; overflow: visible; pointer-events: none; fill: none; }
.gf-back-rim { width: 340px; height: 272px; }
.gf-back-rim path { stroke: rgba(255, 255, 255, .3); stroke-width: 1; }

/* ---- portadas ------------------------------------------------------------ */
.gf-files {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  /* nada cuelga por debajo del bolsillo, por alta que sea la pila */
  clip-path: inset(-400px -400px 10px -400px);
}
.gf-sheet-slot { display: contents; }
.gf-sheet {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  left: 34px;
  top: 96px;
  width: 272px;
  height: 184px;
  border-radius: 16px;
  overflow: hidden;
  cursor: default;
  pointer-events: auto;
  background: linear-gradient(180deg, var(--gma-surface) 0%, var(--gma-panel) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14), 0 0 0 .5px rgba(255, 255, 255, .1), 0 12px 28px -8px rgba(0, 0, 0, .7);
  transform-origin: 50% 100%;
  transform:
    translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)), calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1))
    rotate(calc(var(--gf-jr) + var(--gf-slot) * var(--gf-fan)));
  transition:
    transform .75s var(--gf-spring) calc(var(--gf-depth) * 40ms),
    box-shadow .4s var(--gf-ease),
    translate .9s var(--gf-ease),
    opacity .9s var(--gf-ease);
}
.gf-sheet--art { background: var(--gma-surface-2); }
.gf-root[data-open] .gf-sheet:hover {
  transform:
    translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)), calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1 - 18px))
    rotate(calc(var(--gf-slot) * var(--gf-fan) * .6));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .2), 0 0 0 .5px rgba(255, 255, 255, .16), 0 22px 40px -12px rgba(0, 0, 0, .8);
  transition-delay: 0s;
}
.gf-sheet-art { position: absolute; left: 0; top: 0; width: 272px; height: 184px; max-width: none; object-fit: cover; }
.gf-sheet--art::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
  pointer-events: none;
}
.gf-lines { position: absolute; left: 14px; right: 14px; top: 40px; display: flex; flex-direction: column; gap: 9px; }
.gf-lines i { display: block; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .08); }
.gf-lines i:first-child { height: 9px; margin-bottom: 4px; background: rgba(255, 255, 255, .16); }

/* ---- cristal frontal ------------------------------------------------------- */
.gf-front {
  position: absolute;
  left: 0;
  top: 74px;
  width: 340px;
  height: 198px;
  z-index: 10;
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  backdrop-filter: blur(22px) saturate(1.5);
  transform-origin: 50% 100%;
  transform: perspective(760px) rotateX(var(--gf-hinge));
  transition: transform .8s var(--gf-spring), translate 1s var(--gf-ease), opacity 1s var(--gf-ease);
}
.gf-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--gf-color) 30%, transparent) 0%,
    color-mix(in srgb, var(--gf-color) 40%, var(--gma-bg)) 46%,
    color-mix(in srgb, var(--gf-color) 24%, var(--gma-bg)) 100%
  );
  opacity: .92;
}
.gf-spec {
  position: absolute;
  inset: 0;
  background: radial-gradient(260px 200px at calc(50% + var(--gf-px) * 46%) calc(30% + var(--gf-py) * 40%), rgba(255, 255, 255, .5), rgba(255, 255, 255, 0) 70%);
  mix-blend-mode: screen;
  opacity: .2;
  pointer-events: none;
}
.gf-front-rim { width: 340px; height: 198px; opacity: .6; }
.gf-front-rim path { stroke-width: 2.4; transition: stroke-width .3s var(--gf-ease); }
.gf-hit { all: unset; position: absolute; inset: 0; z-index: 1; cursor: pointer; }
.gf-hit:focus-visible ~ .gf-label .gf-title { text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 4px; }
.gf-front:has(.gf-hit:focus-visible) .gf-front-rim path { stroke-width: 5; }

.gf-label {
  position: absolute;
  left: 28px;
  bottom: 30px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(270px, calc(200px * var(--gf-lz)));
  transform-origin: 0 100%;
  scale: var(--gf-lz);
  pointer-events: none;
  color: #fff;
}
.gf-title { font-size: 18px; font-weight: 600; line-height: 1.15; letter-spacing: -.012em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gf-meta { font-size: 12.5px; font-variant-numeric: tabular-nums; letter-spacing: .01em; color: rgba(255, 255, 255, .72); white-space: nowrap; }

/* ---- entrada: la carpeta se monta sola -------------------------------------- */
.gf-root:not([data-entered]) .gf-back,
.gf-root:not([data-entered]) .gf-back-rim { translate: 0 22px; opacity: 0; }
.gf-root:not([data-entered]) .gf-sheet { translate: 0 -120px; opacity: 0; }
.gf-root:not([data-entered]) .gf-front { translate: 0 46px; opacity: 0; }
.gf-root:not([data-entered]) .gf-shadow { opacity: 0; }
.gf-back, .gf-back-rim { transition: translate 1s var(--gf-ease), opacity .9s var(--gf-ease); }
.gf-root[data-entered] .gf-sheet { transition-delay: calc(var(--gf-depth) * 40ms), 0s, calc(.18s + var(--gf-depth) * 90ms), calc(.18s + var(--gf-depth) * 90ms); }
.gf-root[data-entered] .gf-front { transition-delay: 0s, .42s, .42s; }

@media (prefers-reduced-motion: reduce) {
  .gf-root *, .gf-root *::before, .gf-root *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation: none !important; }
  .gf-tilt { transform: none; }
}
`
