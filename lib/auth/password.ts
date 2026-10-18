/**
 * Reglas y mensajes del cambio de contraseña, compartidos por Configuración y la página de restablecer contraseña.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Devuelve el error a mostrar, o `null` si la nueva contraseña vale. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}

const MESSAGES: Record<string, string> = {
  same_password: "La nueva contraseña tiene que ser distinta de la actual.",
  weak_password: "Esa contraseña es demasiado débil. Prueba con una más larga o que mezcle letras, números y símbolos.",
  invalid_credentials: "La contraseña actual no es correcta.",
  reauthentication_needed: "Por seguridad, vuelve a iniciar sesión y cambia la contraseña justo después.",
  session_not_found: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  over_request_rate_limit: "Demasiados intentos. Espera un momento y vuelve a probar.",
};

/** Traduce un error de Supabase Auth a un mensaje para el usuario. */
export function passwordErrorMessage(error: { readonly code?: string; readonly message: string }): string {
  return (error.code && MESSAGES[error.code]) || "No se pudo cambiar la contraseña. Inténtalo de nuevo.";
}
