import { expect, test } from "@playwright/test";
import { notificationText, relativeTime, shouldNotifyRating, starsToTen } from "../../lib/notifications/rules";

test.describe("notificaciones de valoraciones", () => {
  test("avisa al creador, pero no si se valora su propia obra o la obra no tiene creador", () => {
    expect(shouldNotifyRating({ creatorUserId: "c", raterUserId: "v" })).toBe(true);
    expect(shouldNotifyRating({ creatorUserId: "c", raterUserId: "c" })).toBe(false);
    expect(shouldNotifyRating({ creatorUserId: null, raterUserId: "v" })).toBe(false);
  });

  test("pasa la nota guardada (0–5) a la escala de 1 a 10", () => {
    expect(starsToTen(4)).toBe(8);
    expect(starsToTen(0.5)).toBe(1);
    expect(starsToTen(0)).toBe(1);
  });

  test("texto del aviso", () => {
    expect(notificationText({ kind: "rating", score: 8, title: "Yasha Gozen" })).toBe("Han valorado «Yasha Gozen» con un 8");
  });

  test("tiempo relativo corto", () => {
    const now = new Date("2026-10-18T12:00:00Z").getTime();
    expect(relativeTime(now - 30_000, now)).toBe("ahora");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("hace 5 min");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("hace 3 h");
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("hace 2 d");
  });
});
