import type { ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IconId =
  | "gma"
  | "artist"
  | "astronaut"
  | "cat"
  | "fortune-teller"
  | "panda"
  | "pumpkin"
  | "young-man-1"
  | "young-man-2"
  | "arctic-explorer"
  | "cosmic-princess"
  | "retro-detective"
  | "robot-pilot"
  | "space-dj"
  | "star-chef"
;

export type AvatarColor =
  | "crimson" | "red"    | "pink"   | "rose"     | "wine"
  | "orange"  | "peach"  | "gold"   | "yellow"   | "sand"
  | "lime"    | "mint"   | "green"  | "forest"   | "olive"
  | "teal"    | "cyan"   | "sky"    | "petrol"   | "blue"
  | "navy"    | "indigo" | "violet" | "purple"   | "fuchsia"
  | "lavender"| "brown"  | "copper" | "slate"    | "silver";

export const ICON_IDS: readonly IconId[] = [
  "gma",
  "artist", "astronaut", "cat", "fortune-teller",
  "panda", "pumpkin", "young-man-1", "young-man-2",
  "arctic-explorer", "cosmic-princess",
  "retro-detective",
  "space-dj", "star-chef", "robot-pilot",
];

// Ordenados por familia, en filas de 5 como la cuadrícula del selector: rojos, naranjas, verdes, azules, morados y neutros.
export const COLOR_IDS: readonly AvatarColor[] = [
  "crimson",  "red",    "pink",   "rose",   "wine",
  "orange",   "peach",  "gold",   "yellow", "sand",
  "lime",     "mint",   "green",  "forest", "olive",
  "teal",     "cyan",   "sky",    "petrol", "blue",
  "navy",     "indigo", "violet", "purple", "fuchsia",
  "lavender", "brown",  "copper", "slate",  "silver",
];

export const ICON_LABELS: Record<IconId, string> = {
  gma:                "GMA",
  artist:             "Artista",
  astronaut:          "Astronauta",
  cat:                "Gato",
  "fortune-teller":   "Vidente",
  panda:              "Panda",
  pumpkin:            "Calabaza",
  "young-man-1":      "Chico 1",
  "young-man-2":      "Chico 2",
  "arctic-explorer":  "Explorador",
  "cosmic-princess":  "Princesa",
  "retro-detective":  "Detective",
  "robot-pilot":      "Robot",
  "space-dj":         "DJ",
  "star-chef":        "Chef",
};

export const COLOR_VALUES: Record<AvatarColor, string> = {
  green:   "#22B16B",
  red:     "#F44336",
  orange:  "#FF5722",
  yellow:  "#FFD600",
  blue:    "#2196F3",
  purple:  "#9C27B0",
  pink:    "#E91E63",
  brown:   "#795548",
  navy:    "#1A237E",
  cyan:    "#00BCD4",
  lime:    "#8BC34A",
  teal:    "#009688",
  gold:    "#FF8C00",
  crimson: "#B71C1C",
  violet:  "#5E35B1",
  rose:     "#F8A5C2",
  wine:     "#7B1F3A",
  peach:    "#FFAB91",
  sand:     "#D7B98E",
  mint:     "#69F0AE",
  forest:   "#2E7D32",
  olive:    "#827717",
  sky:      "#81D4FA",
  petrol:   "#00697F",
  indigo:   "#3F51B5",
  fuchsia:  "#D500F9",
  lavender: "#B39DDB",
  copper:   "#B87333",
  slate:    "#607D8B",
  silver:   "#B0BEC5",
};

// ─── Renderer ────────────────────────────────────────────────────────────────

export function renderAvatar(iconId: string, color: string, size?: number, noBg?: boolean): ReactNode {
  const bg  = color.startsWith("#") ? color : (COLOR_VALUES[color as AvatarColor] ?? COLOR_VALUES.green);
  const id  = (ICON_IDS as readonly string[]).includes(iconId) ? iconId : "artist";
  const dim = size != null ? size : "100%";

  const src = id === "gma"
    ? "/avatars-svg/avatar-gma.png"
    : `/avatars-svg/avatar-${id}.svg`;

  return (
    <div
      style={{
        background:     noBg ? "transparent" : bg,
        width:          dim,
        height:         dim,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
        overflow:       "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={ICON_LABELS[id as IconId] ?? id}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

export function isValidIconId(id: string): id is IconId {
  return (ICON_IDS as readonly string[]).includes(id);
}

export function isValidColor(c: string): c is AvatarColor {
  return (COLOR_IDS as readonly string[]).includes(c);
}
