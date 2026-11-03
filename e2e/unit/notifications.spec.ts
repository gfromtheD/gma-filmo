import { expect, test } from "@playwright/test";
import { commentNotificationTargets, notificationText, relativeTime, shouldNotifyRating, starsToTen } from "../../lib/notifications/rules";

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

test.describe("notificaciones de respuestas a comentarios", () => {
  test("responder directamente a un comentario principal avisa solo a su autor", () => {
    expect(commentNotificationTargets({ actorUserId: "yo", replyTargetUserId: "ana", threadOwnerUserId: "ana" }))
      .toEqual([{ userId: "ana", kind: "reply" }]);
  });

  test("responder dentro de un hilo avisa a quien recibe la respuesta y al dueño del hilo, cada uno una vez", () => {
    expect(commentNotificationTargets({ actorUserId: "yo", replyTargetUserId: "luis", threadOwnerUserId: "ana" }))
      .toEqual([{ userId: "luis", kind: "reply" }, { userId: "ana", kind: "thread" }]);
  });

  test("nunca se avisa a la propia cuenta, ni siquiera si es el dueño del hilo o el destinatario", () => {
    expect(commentNotificationTargets({ actorUserId: "yo", replyTargetUserId: "yo", threadOwnerUserId: "yo" })).toEqual([]);
    expect(commentNotificationTargets({ actorUserId: "yo", replyTargetUserId: "luis", threadOwnerUserId: "yo" }))
      .toEqual([{ userId: "luis", kind: "reply" }]);
    expect(commentNotificationTargets({ actorUserId: "yo", replyTargetUserId: "yo", threadOwnerUserId: "ana" }))
      .toEqual([{ userId: "ana", kind: "thread" }]);
  });

  test("los textos nombran a quien responde y la obra", () => {
    expect(notificationText({ kind: "reply", score: null, title: "Simón", actorName: "@ana" })).toBe("@ana ha respondido a tu comentario en «Simón»");
    expect(notificationText({ kind: "thread", score: null, title: "Simón", actorName: "@ana" })).toBe("@ana ha respondido en un hilo tuyo en «Simón»");
    expect(notificationText({ kind: "reply", score: null, title: "Simón" })).toBe("Alguien ha respondido a tu comentario en «Simón»");
  });
});
