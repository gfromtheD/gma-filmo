import { expect, test } from "@playwright/test";
import { etaSeconds, formatElapsed, formatEta, formatMegabytes, formatRate, nextRate } from "../../lib/studio/transfer-stats";

const MB = 1024 ** 2;

test("la velocidad no se calcula con una sola muestra ni con muestras casi simultáneas", () => {
  const first = nextRate(null, 1000, 0);
  expect(first.rate).toBeNull();
  expect(nextRate(first, 1100, 5 * MB).rate).toBeNull(); // 100 ms: demasiado pronto
});

test("la velocidad sale de los bytes entre muestras y se suaviza con la siguiente", () => {
  const a = nextRate(null, 0, 0);
  const b = nextRate(a, 1000, 10 * MB); // 10 MB/s
  expect(b.rate).toBeCloseTo(10 * MB, 0);
  const c = nextRate(b, 2000, 12 * MB); // instantánea 2 MB/s: no salta de golpe
  expect(c.rate!).toBeLessThan(10 * MB);
  expect(c.rate!).toBeGreaterThan(2 * MB);
});

test("si los bytes retroceden (subida reanudada) se empieza de nuevo", () => {
  const b = nextRate(nextRate(null, 0, 0), 1000, 10 * MB);
  expect(nextRate(b, 2000, 1 * MB).rate).toBeNull();
});

test("tiempo restante: bytes que faltan entre velocidad; sin velocidad no hay estimación", () => {
  expect(etaSeconds(100 * MB, 10 * MB)).toBe(10);
  expect(etaSeconds(100 * MB, null)).toBeNull();
  expect(etaSeconds(100 * MB, 0)).toBeNull();
});

test("formatos en español: velocidad, tiempo restante, transcurrido y tamaño", () => {
  expect(formatRate(2.4 * MB)).toBe("2,4 MB/s");
  expect(formatRate(300 * 1024)).toBe("300 KB/s");
  expect(formatEta(20)).toBe("menos de 1 min");
  expect(formatEta(180)).toBe("≈ 3 min");
  expect(formatEta(3900)).toBe("≈ 1 h 05 min");
  expect(formatElapsed(45)).toBe("45 s");
  expect(formatElapsed(185)).toBe("3 min 05 s");
  expect(formatElapsed(3720)).toBe("1 h 02 min");
  expect(formatMegabytes(354 * MB)).toBe("354 MB");
  expect(formatMegabytes(2.5 * 1024 ** 3)).toBe("2,50 GB");
});
