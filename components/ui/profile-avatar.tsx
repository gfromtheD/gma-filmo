"use client";

import { useState } from "react";
import { COLOR_VALUES, renderAvatar, type AvatarColor } from "@/lib/data/profile-avatars";

const FALLBACK_COLORS = ["#22B16B", "#E5654B", "#C28BE6", "#5B8FB0", "#E8C672"] as const;
const INITIAL_TEXT_COLOR = "#03200F";

interface ProfileAvatarProps {
  readonly name: string;
  /** Foto (https, ruta propia o dirección de una imagen subida). */
  readonly url?: string | null;
  /** Icono del catálogo, si el perfil elige uno en vez de una foto. */
  readonly iconId?: string | null;
  /** Identificador de color («purple») o color hexadecimal. */
  readonly color?: string | null;
  /**
   * Diámetro en píxeles, o «fill» para llenar el contenedor (que decide la forma y el tamaño:
   * redondo, esquinas redondeadas, tarjeta del selector…).
   */
  readonly size?: number | "fill";
}

/** Color hexadecimal a partir de un identificador del selector de perfiles o de un hex. */
export function avatarColorHex(color: string | null | undefined, name: string): string {
  if (color) return color.startsWith("#") ? color : (COLOR_VALUES[color as AvatarColor] ?? color);
  return FALLBACK_COLORS[name.length % FALLBACK_COLORS.length] ?? "#22B16B";
}

/**
 * EL redondel de un perfil: el mismo en todo el sitio (comentarios, valoraciones, navbar, selector de
 * perfiles, ajustes…). Muestra la foto, el icono del catálogo o, si no hay ninguno (o la foto no carga),
 * la inicial sobre el color del perfil.
 */
export function ProfileAvatar({ name, url, iconId, color, size = 45 }: ProfileAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hex = avatarColorHex(color, name);
  const fill = size === "fill";
  const frame = fill ? "h-full w-full" : "shrink-0 overflow-hidden rounded-full";
  const frameStyle = fill ? { containerType: "inline-size" as const } : { width: size, height: size };

  if (url && failedUrl !== url) {
    return (
      <div className={frame} style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (iconId) {
    return (
      <div aria-hidden="true" className={frame} style={frameStyle}>
        {renderAvatar(iconId, hex, fill ? undefined : size)}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${frame} flex items-center justify-center font-extrabold`}
      style={{
        ...frameStyle,
        background: hex,
        color: INITIAL_TEXT_COLOR,
        fontSize: fill ? "42cqw" : size * 0.42,
      }}
    >
      {name[0]?.toUpperCase() ?? "U"}
    </div>
  );
}
