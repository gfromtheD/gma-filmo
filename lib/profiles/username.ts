/**
 * El @usuario de una cuenta: único y público (es el nombre que ven los demás al leer un comentario o una
 * valoración). El nombre personal (`profiles.display_name`) es privado y no sale de la cuenta.
 * Lógica pura; las mismas reglas las hace cumplir la base de datos (migración 20261025_profiles_username.sql).
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Minúsculas a-z, cifras y «_». Igual que `username_is_valid()` en la base de datos. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
/** Nombres que podrían hacerse pasar por GMA Filmo. Igual que la lista de `username_is_valid()`. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin", "administrador", "gma", "gmafilmo", "filmo", "soporte", "support",
  "moderador", "moderacion", "root", "sistema", "system", "oficial", "staff",
]);
/** Cambios del @ permitidos dentro de una ventana móvil de `USERNAME_WINDOW_DAYS` días. El primero (desde el @ provisional) es libre. */
export const USERNAME_CHANGE_LIMIT = 3;
export const USERNAME_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

export type UsernameProblem = "short" | "long" | "chars" | "reserved";
export type UsernameSaveError = UsernameProblem | "taken" | "cooldown" | "unknown";

/** Lo que escribe la persona → cómo se guarda: sin espacios, sin «@» delante y en minúsculas. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

/** `null` si el @ (ya normalizado) es válido; si no, el primer problema. */
export function usernameProblem(username: string): UsernameProblem | null {
  if (username.length < USERNAME_MIN) return "short";
  if (username.length > USERNAME_MAX) return "long";
  if (!USERNAME_PATTERN.test(username)) return "chars";
  if (RESERVED_USERNAMES.has(username)) return "reserved";
  return null;
}

export function formatHandle(username: string): string {
  return `@${username}`;
}

export interface UsernameChangeStatus {
  /** Cambios que quedan dentro de la ventana actual. */
  readonly remaining: number;
  /** Cuándo se libera un cambio; `null` si todavía queda alguno. */
  readonly nextChange: Date | null;
}

/** Cambios que quedan a partir de las fechas de los últimos cambios del @ (las más antiguas que la ventana no cuentan). */
export function usernameChangeStatus(changes: readonly Date[], now: Date = new Date()): UsernameChangeStatus {
  const windowStart = now.getTime() - USERNAME_WINDOW_DAYS * DAY_MS;
  const recent = changes.map((d) => d.getTime()).filter((t) => t > windowStart).sort((a, b) => a - b);
  const remaining = Math.max(0, USERNAME_CHANGE_LIMIT - recent.length);
  return { remaining, nextChange: remaining === 0 ? new Date(recent[0]! + USERNAME_WINDOW_DAYS * DAY_MS) : null };
}

/** Error de Supabase al guardar el @ → motivo para la persona. */
export function usernameSaveError(error: { readonly code?: string; readonly message?: string } | null): UsernameSaveError {
  if (error?.code === "23505") return "taken";
  if (error?.code === "23514") return "chars";
  if (error?.code === "P0001" && error.message?.includes("username_cooldown")) return "cooldown";
  return "unknown";
}

export function usernameErrorMessage(reason: UsernameSaveError): string {
  switch (reason) {
    case "short": return `Tiene que tener al menos ${USERNAME_MIN} caracteres.`;
    case "long": return `Como mucho ${USERNAME_MAX} caracteres.`;
    case "chars": return "Solo letras sin tilde, números y «_».";
    case "reserved": return "Ese nombre está reservado.";
    case "taken": return "Ese @ ya lo usa otra persona.";
    case "cooldown": return `Ya has cambiado tu @ ${USERNAME_CHANGE_LIMIT} veces en ${USERNAME_WINDOW_DAYS} días. Inténtalo más adelante.`;
    case "unknown": return "No se pudo guardar. Inténtalo de nuevo.";
  }
}
