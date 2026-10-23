/**
 * Mensajes para el creador. El servidor responde con códigos estables (`UPLOAD_*`, `MEDIA_*`) que la lógica del cliente sigue
 * leyendo tal cual; aquí se traducen SOLO al mostrarlos, para que nadie vea `UPLOAD_REVISION_CONFLICT` en pantalla.
 */
const MESSAGES: Readonly<Record<string, string>> = {
  UPLOAD_REVISION_CONFLICT: "Se estaba guardando otro cambio a la vez. Inténtalo de nuevo en unos segundos.",
  UPLOAD_SLOT_LIMIT: "Has llegado al máximo de esta obra: 12 extras y 5 archivos de subtítulos.",
  UPLOAD_SLOT_OCCUPIED: "Ya hay un archivo subiéndose en ese hueco. Espera a que termine o cancélalo.",
  UPLOAD_CONCURRENCY_LIMIT: "Ya tienes varios archivos subiéndose a la vez. Esperamos a que termine alguno y sigue solo.",
  UPLOAD_QUOTA_EXCEEDED: "No te queda espacio suficiente para este archivo.",
  UPLOAD_MEDIA_NOT_READY: "Algún archivo todavía no está listo. Espera a que termine de procesarse.",
  UPLOAD_NOT_COMPLETE: "La transferencia no ha terminado. Vuelve a intentarlo.",
  UPLOAD_PROCESSING_PENDING: "El archivo sigue procesándose. Puede tardar unos minutos.",
  UPLOAD_SOURCE_MISMATCH: "El archivo no coincide con el que empezaste a subir. Elige el mismo archivo para continuar.",
  UPLOAD_INVALID_INPUT: "Falta algún dato o no es válido. Revísalo e inténtalo de nuevo.",
  UPLOAD_INVALID_ASSET: "El archivo no es válido o no tiene un formato admitido.",
  UPLOAD_ASSET_IN_USE: "Ese archivo todavía se está usando. Inténtalo de nuevo en un momento.",
  UPLOAD_CANCELLED: "La subida se canceló.",
  UPLOAD_EXPIRED: "La subida caducó. Vuelve a subir el archivo.",
  UPLOAD_UNAUTHORIZED: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  UPLOAD_FORBIDDEN: "No tienes permiso para hacer esto.",
  UPLOAD_NOT_FOUND: "No se encontró lo que buscabas. Recarga la página.",
  UPLOAD_ADMISSION_PAUSED: "Las subidas están en pausa un momento. Inténtalo más tarde.",
  UPLOAD_ENGINE_DISABLED: "Las subidas no están disponibles ahora mismo.",
  UPLOAD_UNAVAILABLE: "El servicio de subidas no responde. Inténtalo de nuevo en un momento.",
  UPLOAD_DATABASE_UNAVAILABLE: "El servicio no responde. Inténtalo de nuevo en un momento.",
  UPLOAD_PROVISION_PENDING: "Estamos preparando la subida. Inténtalo de nuevo en unos segundos.",
  UPLOAD_PROVISION_RECOVERY_REQUIRED: "Estamos preparando la subida. Inténtalo de nuevo en unos segundos.",
  UPLOAD_TRANSFER_EXPIRED: "El enlace de subida caducó. Vuelve a intentarlo.",
  UPLOAD_PROTOCOL_UNSUPPORTED: "Este tipo de archivo no se puede subir ahora mismo.",
  UPLOAD_RECEIPT_UNVERIFIED: "No pudimos comprobar que el archivo llegó entero. Vuelve a subirlo.",
  UPLOAD_PROVIDER_OBJECT_MISSING: "El archivo no llegó a guardarse. Vuelve a subirlo.",
  UPLOAD_IDEMPOTENCY_CONFLICT: "Ese envío ya se había hecho con otros datos. Recarga la página.",
  IDEMPOTENCY_CONFLICT: "Ese envío ya se había hecho con otros datos. Recarga la página.",
  MEDIA_PROCESSING_FAILED: "No se pudo procesar el vídeo. Prueba con otro archivo o con otro formato (MP4).",
  MEDIA_PROVIDER_UNAVAILABLE: "El servicio de vídeo no está disponible un momento. Inténtalo de nuevo.",
  MEDIA_NOT_FOUND: "No se encontró el archivo.",
};

/** Nombre, para el creador, de cada campo que el servidor puede rechazar. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  title: "Título", originalTitle: "Título original", synopsis: "Sinopsis", synopsisShort: "Sinopsis corta", synopsisLong: "Sinopsis larga",
  durationMinutes: "Duración", releaseYear: "Año de estreno", year: "Año de estreno", productionCountry: "País de producción",
  language: "Idioma original", ageRating: "Edad recomendada", categories: "Categoría", genres: "Género", genre: "Género", themes: "Temática",
  team: "Créditos", awards: "Premios y selecciones", ai: "Nota sobre la IA", subtitleLanguages: "Subtítulos", extras: "Extras",
  allowComments: "Comentarios", acceptedTerms: "Aceptación de términos", firstFilm: "Ópera prima",
};

const TRANSPORT_SERVER_ERROR = "No pudimos recibir el archivo. Comprueba que es un vídeo válido (MP4) y vuelve a intentarlo.";
/** Respuestas del servidor de subida (pasarela) mientras se envía el archivo. */
const TRANSPORT_MESSAGES: Readonly<Record<string, string>> = {
  "413": "El archivo es demasiado grande.",
  "415": "Este formato de vídeo no se admite. Prueba con MP4.",
  "422": "El archivo no parece un vídeo válido. Prueba con otro (MP4).",
};

const GENERIC ="No se pudo completar. Inténtalo de nuevo y, si sigue fallando, avísanos.";
const CODE = /\b(?:UPLOAD|MEDIA|IDEMPOTENCY)_[A-Z_]+\b/;

/** Traduce un mensaje de error del motor de subidas a algo que entienda un creador. Los textos que ya están en español se respetan. */
export function uploadUserMessage(raw: string | null | undefined, fields?: readonly string[]): string {
  const text = (raw ?? "").trim();
  if (!text) return GENERIC;
  const code = CODE.exec(text)?.[0];
  if (code === "UPLOAD_INVALID_INPUT" && fields && fields.length > 0) {
    const labels = [...new Set(fields.map((f) => FIELD_LABELS[f.split(".")[0]!] ?? null).filter((l): l is string => l !== null))];
    if (labels.length > 0) return `Revisa estos campos: ${labels.join(", ")}. El servidor no los acepta tal como están.`;
  }
  const transport = /\bUPLOADX_HTTP_(\d{3})\b/.exec(text)?.[1];
  if (transport) return TRANSPORT_MESSAGES[transport] ?? (transport.startsWith("5") ? TRANSPORT_SERVER_ERROR : GENERIC);
  if (code) return MESSAGES[code] ?? GENERIC;
  if (/^[A-Z0-9_]{6,}$/.test(text)) return GENERIC;
  return text;
}
