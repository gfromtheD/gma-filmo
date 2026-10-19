import { expect, test } from "@playwright/test";
import {
  RESERVED_USERNAMES, USERNAME_COOLDOWN_DAYS, formatHandle, nextUsernameChangeAt, normalizeUsername, usernameErrorMessage,
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

test("plazo de 30 días: sin fecha (provisional) se puede cambiar ya; después, al cabo de 30 días", () => {
  const changed = new Date("2026-10-01T10:00:00Z");
  expect(nextUsernameChangeAt(null)).toBeNull();
  expect(nextUsernameChangeAt(changed, new Date("2026-10-15T10:00:00Z"))).toEqual(new Date("2026-10-31T10:00:00Z"));
  expect(nextUsernameChangeAt(changed, new Date("2026-10-31T10:00:01Z"))).toBeNull();
  expect(USERNAME_COOLDOWN_DAYS).toBe(30);
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
