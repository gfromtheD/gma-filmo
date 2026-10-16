import { expect, test } from "@playwright/test";
import {
  commentAnchorId,
  formatCompactCount,
  likeButtonLabel,
  parseCommentHash,
  splitLeadingMention,
  sortThreads,
  splitTimestamps,
} from "../../lib/comments/presentation";

test("abrevia los contadores como YouTube: 999, 1,9 K, 12 K, 1,1 M", () => {
  expect(formatCompactCount(0)).toBe("0");
  expect(formatCompactCount(7)).toBe("7");
  expect(formatCompactCount(999)).toBe("999");
  expect(formatCompactCount(1000)).toBe("1 K");
  expect(formatCompactCount(1900)).toBe("1,9 K");
  expect(formatCompactCount(1949)).toBe("1,9 K");
  expect(formatCompactCount(9999)).toBe("9,9 K");
  expect(formatCompactCount(12_345)).toBe("12 K");
  expect(formatCompactCount(999_999)).toBe("999 K");
  expect(formatCompactCount(1_100_000)).toBe("1,1 M");
  expect(formatCompactCount(25_000_000)).toBe("25 M");
});

test("los contadores no válidos se muestran como 0", () => {
  expect(formatCompactCount(-5)).toBe("0");
  expect(formatCompactCount(Number.NaN)).toBe("0");
  expect(formatCompactCount(2.7)).toBe("2");
});

test("nombre accesible del botón «de acuerdo»: describe la acción y cuántas personas más", () => {
  expect(likeButtonLabel({ count: 0, isReply: false, liked: false })).toBe("Indica que te gusta este comentario");
  expect(likeButtonLabel({ count: 1, isReply: false, liked: false })).toBe("Indica que te gusta este comentario junto con otra persona");
  expect(likeButtonLabel({ count: 53, isReply: true, liked: false })).toBe("Indica que te gusta esta respuesta junto con otras 53 personas");
  expect(likeButtonLabel({ count: 1900, isReply: false, liked: false })).toBe("Indica que te gusta este comentario junto con otras 1,9 K personas");
});

test("si ya te gusta, el nombre accesible ofrece quitarlo", () => {
  expect(likeButtonLabel({ count: 3, isReply: false, liked: true })).toBe("Quitar tu «me gusta» de este comentario");
  expect(likeButtonLabel({ count: 3, isReply: true, liked: true })).toBe("Quitar tu «me gusta» de esta respuesta");
});

interface Row {
  id: number;
  like_count: number;
  created_at: string;
  pinned_at?: string | null;
}
const row = (id: number, like_count: number, created_at: string, pinned_at: string | null = null): Row => ({ id, like_count, created_at, pinned_at });
const ids = (rows: readonly Row[]) => rows.map((r) => r.id);

const THREADS = [
  row(1, 0, "2026-10-01T10:00:00Z"),
  row(2, 5, "2026-10-02T10:00:00Z"),
  row(3, 5, "2026-10-03T10:00:00Z"),
  row(4, 1, "2026-10-04T10:00:00Z"),
];

test("«Destacados»: más «me gusta» primero y, a igualdad, el más reciente", () => {
  expect(ids(sortThreads(THREADS, "top"))).toEqual([3, 2, 4, 1]);
});

test("«Más recientes»: del más nuevo al más antiguo", () => {
  expect(ids(sortThreads(THREADS, "recent"))).toEqual([4, 3, 2, 1]);
});

test("un comentario fijado va siempre el primero, con cualquier orden", () => {
  const withPinned = [...THREADS, row(5, 0, "2026-09-01T10:00:00Z", "2026-10-05T10:00:00Z")];
  expect(sortThreads(withPinned, "top")[0]!.id).toBe(5);
  expect(sortThreads(withPinned, "recent")[0]!.id).toBe(5);
});

test("ordenar no modifica la lista original", () => {
  const copy = [...THREADS];
  sortThreads(THREADS, "recent");
  expect(THREADS).toEqual(copy);
});

test("los momentos escritos en el texto («10:32») se convierten en enlaces al minuto", () => {
  expect(splitTimestamps("Mira el 1:23 y luego el 10:32 que es genial", null)).toEqual([
    { type: "text", value: "Mira el " },
    { type: "time", value: "1:23", seconds: 83 },
    { type: "text", value: " y luego el " },
    { type: "time", value: "10:32", seconds: 632 },
    { type: "text", value: " que es genial" },
  ]);
});

test("solo se enlazan momentos válidos y dentro de la duración de la obra", () => {
  const inside = splitTimestamps("a 0:30 y 2:10", 120);
  expect(inside.filter((s) => s.type === "time").map((s) => s.value)).toEqual(["0:30"]); // 2:10 se pasa de 2:00
  expect(splitTimestamps("hora 12:75 mal", null).some((s) => s.type === "time")).toBe(false);
  expect(splitTimestamps("1:02:03 largo", null)).toEqual([
    { type: "time", value: "1:02:03", seconds: 3723 },
    { type: "text", value: " largo" },
  ]);
});

test("no confunde números sueltos, versiones o relaciones con momentos", () => {
  expect(splitTimestamps("version 2.10 y 3:4 y a1:23b", null).some((s) => s.type === "time")).toBe(false);
  expect(splitTimestamps("sin momentos", null)).toEqual([{ type: "text", value: "sin momentos" }]);
  expect(splitTimestamps("", null)).toEqual([]);
});

test("enlace permanente a un comentario: ancla y lectura del hash", () => {
  expect(commentAnchorId(42)).toBe("comentario-42");
  expect(parseCommentHash("#comentario-42")).toBe(42);
  expect(parseCommentHash("comentario-7")).toBe(7);
  expect(parseCommentHash("#comentarios")).toBeNull();
  expect(parseCommentHash("#comentario-")).toBeNull();
  expect(parseCommentHash("#comentario-abc")).toBeNull();
  expect(parseCommentHash("#comentario-0")).toBeNull();
  expect(parseCommentHash("")).toBeNull();
});

test("detecta la mención del principio («@Nombre texto») entre los participantes del hilo", () => {
  const names = ["Ana", "G Dclan", "Ana María"];
  expect(splitLeadingMention("@Ana hola", names)).toEqual({ mention: "@Ana", rest: " hola" });
  expect(splitLeadingMention("@G Dclan de acuerdo", names)).toEqual({ mention: "@G Dclan", rest: " de acuerdo" });
  expect(splitLeadingMention("@Ana María qué bien", names)).toEqual({ mention: "@Ana María", rest: " qué bien" }); // gana el nombre más largo
  expect(splitLeadingMention("@Ana", names)).toEqual({ mention: "@Ana", rest: "" });
  expect(splitLeadingMention("@Ana, mira", names)).toEqual({ mention: "@Ana", rest: ", mira" });
});

test("no hay mención si no está al principio, el nombre no es del hilo o solo coincide en parte", () => {
  const names = ["Ana"];
  expect(splitLeadingMention("hola @Ana", names)).toBeNull();
  expect(splitLeadingMention("@Pedro hola", names)).toBeNull();
  expect(splitLeadingMention("@Anabel hola", names)).toBeNull();
  expect(splitLeadingMention("@ana hola", names)).toBeNull(); // distingue mayúsculas
  expect(splitLeadingMention("", names)).toBeNull();
  expect(splitLeadingMention("@Ana hola", [])).toBeNull();
});
