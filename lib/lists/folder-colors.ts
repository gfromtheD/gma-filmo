/** Colores que puede tener una carpeta de Mi lista. El orden de esta lista es también el orden «por color». */
export interface FolderColor {
  readonly id: string;
  readonly label: string;
  readonly hex: string;
}

export const FOLDER_COLORS: readonly FolderColor[] = [
  { id: "verde", label: "Verde", hex: "#22B16B" },
  { id: "azul", label: "Azul", hex: "#3F86E0" },
  { id: "violeta", label: "Violeta", hex: "#7A5CE0" },
  { id: "rosa", label: "Rosa", hex: "#D95C9B" },
  { id: "rojo", label: "Rojo", hex: "#E2514B" },
  { id: "naranja", label: "Naranja", hex: "#E8893A" },
  { id: "amarillo", label: "Amarillo", hex: "#D9B43A" },
  { id: "gris", label: "Gris", hex: "#7C8A99" },
];

/** Color por defecto: Seguir viendo azul, Guardados verde, Valoradas violeta y las listas propias rotan por la paleta según su id. */
export function defaultFolderColor(id: string, kind: "saved" | "rated" | "continue" | "custom"): string {
  if (kind === "continue") return FOLDER_COLORS[1]!.hex;
  if (kind === "saved") return FOLDER_COLORS[0]!.hex;
  if (kind === "rated") return FOLDER_COLORS[2]!.hex;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // Las listas propias no usan el verde, el violeta ni el azul, que son de las carpetas fijas.
  const own = FOLDER_COLORS.filter((c) => c.id !== "verde" && c.id !== "violeta" && c.id !== "azul");
  return own[h % own.length]!.hex;
}

/** Posición del color en la paleta (para ordenar por color); los desconocidos van al final. */
export function folderColorRank(hex: string): number {
  const i = FOLDER_COLORS.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return i === -1 ? FOLDER_COLORS.length : i;
}

/** Tipos de carpeta al crear una nueva: dan nombre y color de partida, que se pueden cambiar. */
export interface FolderTemplate {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly color: string;
}

export const FOLDER_TEMPLATES: readonly FolderTemplate[] = [
  { id: "blanco", label: "En blanco", name: "", color: FOLDER_COLORS[0]!.hex },
  { id: "luego", label: "Para ver luego", name: "Para ver luego", color: FOLDER_COLORS[1]!.hex },
  { id: "favoritas", label: "Favoritas", name: "Favoritas", color: FOLDER_COLORS[4]!.hex },
  { id: "amigos", label: "Con amigos", name: "Para ver con amigos", color: FOLDER_COLORS[5]!.hex },
  { id: "noche", label: "Para una noche", name: "Para una noche", color: FOLDER_COLORS[2]!.hex },
  { id: "clasicos", label: "Clásicos", name: "Clásicos", color: FOLDER_COLORS[6]!.hex },
  { id: "inspiracion", label: "Inspiración", name: "Inspiración", color: FOLDER_COLORS[3]!.hex },
];
