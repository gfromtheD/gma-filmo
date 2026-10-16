import { expect, test } from "@playwright/test";
import {
  formatTimestamp,
  parseRuntimeSeconds,
  parseTimestampInput,
  validateTimestamp,
  workNoun,
} from "../../lib/comments/timestamp";

test("lee m:ss y h:mm:ss y rechaza formatos inválidos", () => {
  expect(parseTimestampInput("1:23")).toBe(83);
  expect(parseTimestampInput("0:05")).toBe(5);
  expect(parseTimestampInput("13:12")).toBe(792);
  expect(parseTimestampInput("1:02:03")).toBe(3723);
  expect(parseTimestampInput("  2:00 ")).toBe(120);
  expect(parseTimestampInput("")).toBeNull();
  expect(parseTimestampInput("abc")).toBeNull();
  expect(parseTimestampInput("5")).toBeNull();
  expect(parseTimestampInput("1:2:3:4")).toBeNull();
  expect(parseTimestampInput("-1:20")).toBeNull();
  expect(parseTimestampInput("1.5:20")).toBeNull();
});

test("los segundos (y los minutos si hay horas) deben estar entre 0 y 59", () => {
  expect(parseTimestampInput("1:99")).toBeNull();
  expect(parseTimestampInput("1:60")).toBeNull();
  expect(parseTimestampInput("1:59")).toBe(119);
  expect(parseTimestampInput("1:75:00")).toBeNull();
});

test("interpreta la duración guardada de la obra (horas, minutos y segundos)", () => {
  expect(parseRuntimeSeconds("1m 12s")).toBe(72);
  expect(parseRuntimeSeconds("58s")).toBe(58);
  expect(parseRuntimeSeconds("4m 30s")).toBe(270);
  expect(parseRuntimeSeconds("2m")).toBe(120);
  expect(parseRuntimeSeconds("1h 20m")).toBe(4800);
  expect(parseRuntimeSeconds("1h 02m 03s")).toBe(3723);
  expect(parseRuntimeSeconds("Corto")).toBeNull();
  expect(parseRuntimeSeconds("")).toBeNull();
  expect(parseRuntimeSeconds(null)).toBeNull();
  expect(parseRuntimeSeconds(undefined)).toBeNull();
});

test("un momento más allá de la duración del corto no es válido (2 min y se pide 13:12)", () => {
  const result = validateTimestamp("13:12", 120);
  expect(result).toEqual({ ok: false, reason: "beyond", maxSeconds: 120 });
});

test("el momento puede llegar justo hasta el final pero no pasarse", () => {
  expect(validateTimestamp("2:00", 120)).toEqual({ ok: true, seconds: 120 });
  expect(validateTimestamp("2:01", 120)).toMatchObject({ ok: false, reason: "beyond" });
  expect(validateTimestamp("1:59", 120)).toEqual({ ok: true, seconds: 119 });
});

test("si no se conoce la duración solo se comprueba el formato", () => {
  expect(validateTimestamp("13:12", null)).toEqual({ ok: true, seconds: 792 });
  expect(validateTimestamp("1:99", null)).toEqual({ ok: false, reason: "format" });
});

test("el campo vacío no es un error (el momento es opcional)", () => {
  expect(validateTimestamp("", 120)).toEqual({ ok: true, seconds: null });
  expect(validateTimestamp("   ", null)).toEqual({ ok: true, seconds: null });
});

test("formatea el tiempo como m:ss o h:mm:ss", () => {
  expect(formatTimestamp(0)).toBe("0:00");
  expect(formatTimestamp(120)).toBe("2:00");
  expect(formatTimestamp(792)).toBe("13:12");
  expect(formatTimestamp(3723)).toBe("1:02:03");
});

test("la nomenclatura depende de la sección: cortometraje o película", () => {
  expect(workNoun("cortometraje")).toMatchObject({ del: "del cortometraje", name: "cortometraje" });
  expect(workNoun("pelicula")).toMatchObject({ del: "de la película", name: "película" });
});
