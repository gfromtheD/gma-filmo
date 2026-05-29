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
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "navy"
  | "cyan"
  | "lime"
  | "teal"
  | "gold"
  | "crimson"
  | "violet";

export const ICON_IDS: readonly IconId[] = [
  "gma",
  "artist", "astronaut", "cat", "fortune-teller",
  "panda", "pumpkin", "young-man-1", "young-man-2",
  "arctic-explorer", "cosmic-princess",
  "retro-detective",
  "space-dj", "star-chef", "robot-pilot",
];

export const COLOR_IDS: readonly AvatarColor[] = [
  "green",  "red",    "orange", "yellow", "blue",
  "navy",   "purple", "pink",   "teal",   "cyan",
  "lime",   "brown",  "gold",   "crimson","violet",
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
