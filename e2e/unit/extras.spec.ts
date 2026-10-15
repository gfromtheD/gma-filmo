import { expect, test } from "@playwright/test";
import {
  EXTRA_KINDS,
  extraKindLabel,
  formatExtraDuration,
  groupExtraKinds,
  parseExtraInput,
  rowToExtra,
  sortExtras,
  type ExtraRow,
} from "../../lib/extras/extras";

const row = (partial: Partial<ExtraRow> = {}): ExtraRow => ({
  id: 1,
  pelicula_id: 7,
  title: "Así se hizo",
  description: null,
  kind: "making_of",
  provider: "r2",
  video_url: "https://media.gmafilmo.test/uploads/u/1/extras.mp4",
  media_ref: null,
  poster_url: null,
  duration_seconds: 125,
  file_size_bytes: null,
  sort_order: 0,
  status: "published",
  ...partial,
});

test("formatea la duración como m:ss y h:mm:ss, y oculta valores no válidos", () => {
  expect(formatExtraDuration(125)).toBe("2:05");
  expect(formatExtraDuration(59)).toBe("0:59");
  expect(formatExtraDuration(3725)).toBe("1:02:05");
  expect(formatExtraDuration(0)).toBeNull();
  expect(formatExtraDuration(null)).toBeNull();
  expect(formatExtraDuration(-4)).toBeNull();
});

test("cada tipo tiene etiqueta en español y los desconocidos caen en «Extra»", () => {
  expect(EXTRA_KINDS).toContain("making_of");
  expect(extraKindLabel("making_of")).toBe("Making of");
  expect(extraKindLabel("escena_eliminada")).toBe("Escena eliminada");
  expect(extraKindLabel("algo-raro")).toBe("Extra");
});

test("convierte una fila en un extra de la interfaz (sin URL no se muestra)", () => {
  const extra = rowToExtra(row({ description: "  Detrás de cámaras  " }));
  expect(extra).toMatchObject({
    id: 1,
    title: "Así se hizo",
    description: "Detrás de cámaras",
    kind: "making_of",
    kindLabel: "Making of",
    durationLabel: "2:05",
    videoUrl: "https://media.gmafilmo.test/uploads/u/1/extras.mp4",
  });
  expect(rowToExtra(row({ video_url: "" }))).toBeNull();
  expect(rowToExtra(row({ status: "draft" }))).toBeNull();
  expect(rowToExtra(row({ video_url: "javascript:alert(1)" }))).toBeNull();
});

test("ordena por sort_order y después por id, sin mutar la lista original", () => {
  const items = [row({ id: 3, sort_order: 1 }), row({ id: 2, sort_order: 0 }), row({ id: 1, sort_order: 1 })];
  const snapshot = items.map((r) => r.id);
  expect(sortExtras(items).map((r) => r.id)).toEqual([2, 1, 3]);
  expect(items.map((r) => r.id)).toEqual(snapshot);
});

test("agrupa los tipos presentes en orden estable con su recuento", () => {
  const extras = [
    rowToExtra(row({ id: 1, kind: "entrevista" })),
    rowToExtra(row({ id: 2, kind: "making_of" })),
    rowToExtra(row({ id: 3, kind: "entrevista" })),
  ].filter((e) => e !== null);
  expect(groupExtraKinds(extras)).toEqual([
    { kind: "making_of", label: "Making of", count: 1 },
    { kind: "entrevista", label: "Entrevista", count: 2 },
  ]);
});

test("valida la entrada de un creador: título, tipo, https y límites", () => {
  const ok = parseExtraInput({ title: "  Entrevista  ", kind: "entrevista", videoUrl: "https://cdn.example.com/a.mp4" });
  expect(ok.success).toBe(true);
  if (ok.success) expect(ok.data.title).toBe("Entrevista");

  expect(parseExtraInput({ title: "", kind: "entrevista", videoUrl: "https://a.b/c.mp4" }).success).toBe(false);
  expect(parseExtraInput({ title: "x", kind: "inventado", videoUrl: "https://a.b/c.mp4" }).success).toBe(false);
  expect(parseExtraInput({ title: "x", kind: "otro", videoUrl: "http://a.b/c.mp4" }).success).toBe(false);
  expect(parseExtraInput({ title: "x", kind: "otro", videoUrl: "javascript:alert(1)" }).success).toBe(false);
  expect(parseExtraInput({ title: "x".repeat(121), kind: "otro", videoUrl: "https://a.b/c.mp4" }).success).toBe(false);
  expect(parseExtraInput({ title: "x", kind: "otro", videoUrl: "https://a.b/c.mp4", durationSeconds: -1 }).success).toBe(false);
});
