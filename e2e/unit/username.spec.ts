import { expect, test } from "@playwright/test";
import {
  RESERVED_USERNAMES, USERNAME_CHANGE_LIMIT, USERNAME_WINDOW_DAYS, formatHandle, usernameChangeStatus, normalizeUsername, usernameErrorMessage,
  usernameProblem, usernameSaveError,
} from "../../lib/profiles/username";

test("normaliza lo que se escribe: sin espacios, sin arroba delante y en minúsculas", () => {
  expect(normalizeUsername("  @Ana_G ")).toBe("ana_g");
  expect(normalizeUsername("@@pepe")).toBe("pepe");
});

test("valida el formato igual que la base de datos", () => {
  expect(usernameProblem("ana_g")).toBeNull();
  expect(usernameProblem("a1_")).toBeNull();
  expect(usernameProblem("ab")).toBe("short");
  expect(usernameProblem("a".repeat(21))).toBe("long");
  expect(usernameProblem("a".repeat(20))).toBeNull();
  expect(usernameProblem("ana.g")).toBe("chars");
  expect(usernameProblem("josé")).toBe("chars");
  expect(usernameProblem("ana g")).toBe("chars");
  expect(usernameProblem("Ana")).toBe("chars");
  for (const reserved of RESERVED_USERNAMES) expect(usernameProblem(reserved)).toBe("reserved");
});

test("el @ se muestra con la arroba", () => {
  expect(formatHandle("ana_g")).toBe("@ana_g");
});

test("3 cambios cada 7 días: sin cambios previos quedan 3; al gastarlos, se libera uno cuando el más antiguo cumple la semana", () => {
  const day = (d: number) => new Date(`2026-10-${String(d).padStart(2, "0")}T10:00:00Z`);
  expect(usernameChangeStatus([])).toEqual({ remaining: 3, nextChange: null });
  expect(usernameChangeStatus([day(1)], day(2))).toEqual({ remaining: 2, nextChange: null });
  expect(usernameChangeStatus([day(1), day(2), day(3)], day(4))).toEqual({ remaining: 0, nextChange: day(8) });
  expect(usernameChangeStatus([day(1), day(2), day(3)], new Date("2026-10-08T10:00:01Z"))).toEqual({ remaining: 1, nextChange: null });
  expect([USERNAME_CHANGE_LIMIT, USERNAME_WINDOW_DAYS]).toEqual([3, 7]);
});

test("traduce los errores de la base de datos a un motivo", () => {
  expect(usernameSaveError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("taken");
  expect(usernameSaveError({ code: "23514", message: "violates check constraint" })).toBe("chars");
  expect(usernameSaveError({ code: "P0001", message: "username_cooldown" })).toBe("cooldown");
  expect(usernameSaveError({ code: "P0001", message: "otra cosa" })).toBe("unknown");
  expect(usernameSaveError(null)).toBe("unknown");
});

test("cada motivo tiene un mensaje en español", () => {
  for (const reason of ["short", "long", "chars", "reserved", "taken", "cooldown", "unknown"] as const) {
    expect(usernameErrorMessage(reason).length).toBeGreaterThan(5);
  }
});
