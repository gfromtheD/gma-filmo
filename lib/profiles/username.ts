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
/** Días entre dos cambios del @. El primero (desde el @ provisional) es libre. */
export const USERNAME_COOLDOWN_DAYS = 30;

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

/** Fecha a partir de la cual se puede volver a cambiar el @; `null` si ya se puede (o nunca se ha elegido). */
export function nextUsernameChangeAt(changedAt: Date | null, now: Date = new Date()): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS);
  return next.getTime() > now.getTime() ? next : null;
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
    case "cooldown": return `Solo puedes cambiar tu @ una vez cada ${USERNAME_COOLDOWN_DAYS} días.`;
    case "unknown": return "No se pudo guardar. Inténtalo de nuevo.";
  }
}
