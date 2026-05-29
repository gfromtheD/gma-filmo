"use client";

import type { PosterRatio, PosterStyle } from "@/types/catalog";
import type { MotifName } from "@/types/catalog";

// Stable pseudo-random — same output on every call with same seed.
// Eliminates server/client hydration mismatches for particle art.
function pseudo(n: number): number {
  const x = Math.sin(n + 1) * 10_000;
  return x - Math.floor(x);
}

// Particle arrays are generated once at module scope, never during render.
const BELT_STARS = Array.from({ length: 40 }, (_, i) => ({
  cx: 5 + pseudo(i) * 90,
  cy: 5 + pseudo(i + 50) * 140,
  r: pseudo(i + 100) * 0.6,
  opacity: pseudo(i + 150) * 0.5,
}));

const CIPHER_GRID = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 10 }, (_, c) => ({
    opacity: pseudo(r * 10 + c) * 0.4,
    char: pseudo(r * 10 + c + 80) > 0.5 ? "1" : "0",
  }))
);

const ARROW_STARS = Array.from({ length: 20 }, (_, i) => ({
  cx: pseudo(i + 200) * 100,
  cy: pseudo(i + 220) * 150,
}));

const FROST_FLAKES = Array.from({ length: 60 }, (_, i) => ({
  cx: pseudo(i + 300) * 100,
  cy: pseudo(i + 360) * 150,
  r: pseudo(i + 420) * 1.2,
  opacity: pseudo(i + 480) * 0.6,
}));

const CLOUD_BUBBLES = Array.from({ length: 8 }, (_, i) => ({
  cx: 20 + i * 8,
  cy: 90 + Math.sin(i) * 4,
}));

const TIRE_SPOKES = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30;
  return {
    x2: 50 + Math.cos((deg * Math.PI) / 180) * 18,
    y2: 65 + Math.sin((deg * Math.PI) / 180) * 18,
  };
});

const ROTOR_ANGLES = [0, 60, 120, 180, 240, 300];
const VAULT_LINES  = [0, 60, 120, 180, 240, 300];
const SUN_RAYS     = [0, 45, 90, 135, 180, 225, 270, 315];

type MotifFn = (accent: string) => React.ReactNode;

const MOTIFS: Record<MotifName, MotifFn> = {
  belt: (a) => (
    <>
      <ellipse cx="50" cy="75" rx="55" ry="12" stroke={a} strokeWidth="0.4" opacity="0.5" fill="none"/>
      <ellipse cx="50" cy="75" rx="42" ry="9"  stroke={a} strokeWidth="0.3" opacity="0.35" fill="none"/>
      <circle cx="50" cy="75" r="14" fill={a} opacity="0.18"/>
      <circle cx="50" cy="75" r="6"  fill={a} opacity="0.55"/>
      {BELT_STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity}/>
      ))}
    </>
  ),
  splatter: (a) => (
    <>
      <circle cx="30" cy="60" r="22" fill={a} opacity="0.85"/>
      <circle cx="68" cy="48" r="10" fill={a} opacity="0.5"/>
      <circle cx="75" cy="90" r="6"  fill={a} opacity="0.4"/>
      <circle cx="20" cy="100" r="4" fill={a} opacity="0.6"/>
      <circle cx="45" cy="30" r="3"  fill={a} opacity="0.5"/>
    </>
  ),
  vault: (a) => (
    <>
      <circle cx="50" cy="65" r="32" stroke={a} strokeWidth="1.5" fill="none" opacity="0.7"/>
      <circle cx="50" cy="65" r="20" stroke={a} strokeWidth="0.8" fill="none" opacity="0.5"/>
      <text x="50" y="72" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="18" fill={a} opacity="0.85">76</text>
      {VAULT_LINES.map((d) => (
        <line key={d} x1="50" y1="65"
              x2={50 + Math.cos((d * Math.PI) / 180) * 30}
              y2={65 + Math.sin((d * Math.PI) / 180) * 30}
              stroke={a} strokeWidth="0.5" opacity="0.4"/>
      ))}
    </>
  ),
  monogram: (a) => (
    <text x="50" y="80" textAnchor="middle" fontFamily="Manrope" fontWeight="900" fontSize="64" fill={a} opacity="0.85" letterSpacing="-3">R</text>
  ),
  cipher: (a) => (
    <>
      {CIPHER_GRID.map((row, r) =>
        row.map((cell, c) => (
          <text key={`${r}-${c}`} x={5 + c * 10} y={20 + r * 15}
                fontFamily="monospace" fontSize="9" fill={a} opacity={cell.opacity}>
            {cell.char}
          </text>
        ))
      )}
      <rect x="20" y="50" width="60" height="50" fill={a} opacity="0.15"/>
    </>
  ),
  ring: (a) => (
    <>
      <circle cx="50" cy="65" r="28" stroke={a} strokeWidth="2" fill="none"/>
      <circle cx="50" cy="65" r="22" stroke={a} strokeWidth="0.8" fill="none" opacity="0.6"/>
      <path d="M 30 50 Q 50 70, 70 50" stroke={a} strokeWidth="0.4" fill="none" opacity="0.7"/>
    </>
  ),
  mic: (a) => (
    <>
      <rect x="44" y="35" width="12" height="30" rx="6" fill={a} opacity="0.85"/>
      <path d="M 38 60 Q 50 75, 62 60" stroke={a} strokeWidth="1" fill="none" opacity="0.7"/>
      <line x1="50" y1="75" x2="50" y2="90" stroke={a} strokeWidth="1" opacity="0.6"/>
      <line x1="42" y1="90" x2="58" y2="90" stroke={a} strokeWidth="1" opacity="0.6"/>
    </>
  ),
  tag: (a) => (
    <>
      <rect x="20" y="55" width="60" height="35" rx="3" stroke={a} strokeWidth="0.8" fill="none" opacity="0.7"/>
      <circle cx="28" cy="63" r="2" stroke={a} strokeWidth="0.8" fill="none"/>
      <text x="50" y="78" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="12" fill={a} opacity="0.85" letterSpacing="2">RYAN</text>
    </>
  ),
  lightning: (a) => (
    <path d="M 55 30 L 35 70 L 50 70 L 40 110 L 65 65 L 50 65 Z" fill={a} opacity="0.85"/>
  ),
  cap: (a) => (
    <>
      <path d="M 25 70 Q 50 40, 75 70" stroke={a} strokeWidth="1.5" fill="none" opacity="0.7"/>
      <text x="50" y="85" textAnchor="middle" fontFamily="Manrope" fontWeight="900" fontSize="22" fill={a} opacity="0.85">V</text>
    </>
  ),
  cloud: (a) => (
    <>
      <ellipse cx="50" cy="60" rx="28" ry="14" fill={a} opacity="0.25"/>
      <ellipse cx="50" cy="60" rx="20" ry="9"  fill={a} opacity="0.5"/>
      {CLOUD_BUBBLES.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r="1" fill={a} opacity="0.4"/>
      ))}
    </>
  ),
  frost: (a) => (
    <>
      {FROST_FLAKES.map((f, i) => (
        <circle key={i} cx={f.cx} cy={f.cy} r={f.r} fill="white" opacity={f.opacity}/>
      ))}
      <path d="M 0 100 Q 25 90, 50 95 T 100 100 L 100 150 L 0 150 Z" fill={a} opacity="0.25"/>
    </>
  ),
  cross: (a) => (
    <>
      <rect x="46" y="35" width="8"  height="50" fill={a} opacity="0.8"/>
      <rect x="30" y="51" width="40" height="8"  fill={a} opacity="0.8"/>
      <circle cx="50" cy="60" r="36" stroke={a} strokeWidth="0.4" fill="none" opacity="0.3"/>
    </>
  ),
  crown: (a) => (
    <>
      <path d="M 25 75 L 25 50 L 38 60 L 50 40 L 62 60 L 75 50 L 75 75 Z"
            stroke={a} strokeWidth="1" fill={a} fillOpacity="0.15"/>
      <circle cx="38" cy="60" r="2" fill={a}/>
      <circle cx="50" cy="40" r="2" fill={a}/>
      <circle cx="62" cy="60" r="2" fill={a}/>
    </>
  ),
  rotor: (a) => (
    <>
      <circle cx="50" cy="65" r="5" fill={a}/>
      {ROTOR_ANGLES.map((d) => (
        <ellipse key={d} cx="50" cy="65" rx="28" ry="2"
                 transform={`rotate(${d} 50 65)`} fill={a} opacity="0.5"/>
      ))}
    </>
  ),
  crest: (a) => (
    <>
      <path d="M 35 35 L 65 35 L 70 70 Q 50 90, 30 70 Z"
            stroke={a} strokeWidth="1" fill={a} fillOpacity="0.2"/>
      <line x1="50" y1="40" x2="50" y2="80" stroke={a} strokeWidth="0.5" opacity="0.5"/>
      <line x1="35" y1="55" x2="65" y2="55" stroke={a} strokeWidth="0.5" opacity="0.5"/>
    </>
  ),
  gun: (a) => (
    <>
      <rect x="20" y="65" width="50" height="6" rx="1" fill={a} opacity="0.8"/>
      <rect x="55" y="55" width="20" height="6" rx="1" fill={a} opacity="0.8"/>
      <circle cx="30" cy="68" r="3" stroke={a} strokeWidth="0.6" fill="none"/>
    </>
  ),
  tire: (a) => (
    <>
      <circle cx="50" cy="65" r="26" stroke={a} strokeWidth="3" fill="none"/>
      <circle cx="50" cy="65" r="8"  fill={a} opacity="0.6"/>
      {TIRE_SPOKES.map((s, i) => (
        <line key={i} x1="50" y1="65" x2={s.x2} y2={s.y2}
              stroke={a} strokeWidth="0.6" opacity="0.5"/>
      ))}
    </>
  ),
  web: (a) => (
    <g stroke={a} strokeWidth="0.5" fill="none" opacity="0.65">
      <path d="M 50 30 L 50 100"/>
      <path d="M 20 65 L 80 65"/>
      <path d="M 28 43 L 72 87"/>
      <path d="M 28 87 L 72 43"/>
      <path d="M 35 50 Q 50 60, 65 50"/>
      <path d="M 30 65 Q 50 80, 70 65"/>
      <path d="M 25 80 Q 50 95, 75 80"/>
    </g>
  ),
  arrow: (a) => (
    <>
      <path d="M 30 60 L 70 60 M 55 45 L 70 60 L 55 75"
            stroke={a} strokeWidth="3" fill="none" strokeLinecap="round"/>
      {ARROW_STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r="0.6" fill="white" opacity="0.4"/>
      ))}
    </>
  ),
  jump: (a) => (
    <>
      <path d="M 30 80 Q 40 30, 50 50 Q 60 70, 80 30" stroke={a} strokeWidth="2" fill="none"/>
      <circle cx="80" cy="30" r="3" fill={a}/>
    </>
  ),
  pen: (a) => (
    <>
      <path d="M 25 90 L 75 30 L 80 35 L 30 95 Z" stroke={a} strokeWidth="0.8" fill={a} fillOpacity="0.2"/>
      <path d="M 70 25 L 85 40" stroke={a} strokeWidth="0.8"/>
    </>
  ),
  sun: (a) => (
    <>
      <circle cx="50" cy="60" r="14" fill={a} opacity="0.85"/>
      {SUN_RAYS.map((d) => {
        const x1 = 50 + Math.cos((d * Math.PI) / 180) * 22;
        const y1 = 60 + Math.sin((d * Math.PI) / 180) * 22;
        const x2 = 50 + Math.cos((d * Math.PI) / 180) * 32;
        const y2 = 60 + Math.sin((d * Math.PI) / 180) * 32;
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a} strokeWidth="1.5" opacity="0.6"/>;
      })}
      <path d="M 0 120 Q 50 100, 100 120 L 100 150 L 0 150 Z" fill={a} opacity="0.2"/>
    </>
  ),
  paper: (a) => (
    <>
      <rect x="25" y="35" width="50" height="65" rx="2" fill={a} opacity="0.3"/>
      <rect x="30" y="35" width="50" height="65" rx="2" stroke={a} strokeWidth="0.6" fill="none" opacity="0.6"/>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="35" y1={50 + i * 10} x2="75" y2={50 + i * 10}
              stroke={a} strokeWidth="0.4" opacity="0.5"/>
      ))}
    </>
  ),
};

interface PosterArtProps {
  readonly style: PosterStyle;
  readonly title: string;
  readonly kind: string;
  readonly genre?: string;
  readonly ratio?: PosterRatio;
  readonly imageUrl?: string;
}

export function PosterArt({ style, title, kind, genre, ratio = "portrait", imageUrl }: PosterArtProps) {
  const [c1, c2] = style.tone;
  const motifFn = MOTIFS[style.motif];
  const aspect = ratio === "landscape" ? "16/9" : ratio === "square" ? "1/1" : "2/3";

  return (
    <div
      className="group/poster relative isolate overflow-hidden rounded-[6px]"
      style={{ aspectRatio: aspect, width: "100%" }}
    >
      {/* Gradient background — always present as fallback */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(155deg, ${c1} 0%, ${c2} 100%)` }}
      />

      {imageUrl ? (
        /* Real poster image — onError falls back to SVG motif */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        /* SVG motif fallback */
        <svg
          viewBox="0 0 100 150"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          style={{ opacity: 0.9 }}
          aria-hidden="true"
        >
          {motifFn(style.accent)}
        </svg>
      )}

      {/* Vignette + bottom fade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, transparent 40%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85) 100%)",
          zIndex: 1,
        }}
      />

      {/* Title strip */}
      <div className="absolute bottom-0 left-0 right-0 px-[14px] pb-[12px] pt-[14px]" style={{ zIndex: 2 }}>
        <div className="mb-[6px] text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
          {genre ?? (kind === "movie" ? "Corto" : "Serie")}
        </div>
        <div
          className="text-[16px] font-extrabold leading-[1.1] tracking-[-0.01em] text-white"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
        >
          {title}
        </div>
      </div>

      {/* Accent shine on hover (activated by parent .group/card) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[250ms] group-hover/card:opacity-100"
        style={{
          background:
            "linear-gradient(180deg, rgba(34,177,107,0.0) 50%, rgba(34,177,107,0.18) 100%)",
          zIndex: 3,
        }}
      />
    </div>
  );
}
