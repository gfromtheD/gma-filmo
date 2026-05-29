export const APP_NAME = "GMA Filmo";

export const APP_LOCALE = "es";

export const APP_METADATA = {
  title: "GMA Filmo",
  description: "El cine es nuestro.",
} as const;

export const SCAFFOLD_COPY = {
  statusLabel: "Base preparada",
  statusDescription:
    "Estructura lista para conectar catálogo, autenticación, pagos y distribución de video.",
  routeBadge: "Ruta",
  childSectionsTitle: "Capacidades reservadas",
  nextStepTitle: "Siguiente decisión",
  nextStepBody:
    "Elige una sección del árbol de navegación para construirla con layout, estado, servicios y flujo completo.",
  protectedBadge: "Protegida",
  publicBadge: "Pública",
  footerLegal: "Arquitectura preparada para Vercel, Supabase y Cloudflare.",
  unavailableStream: "Stream no disponible",
  unavailableStreamDescription:
    "El reproductor está preparado para recibir una URL de Cloudflare Stream o R2 cuando el backend esté conectado.",
} as const;

export const HEALTH_COPY = {
  service: "streaming-app",
  okStatus: "ok",
  errorStatus: "error",
  bootMessage: "API operativa",
  failureMessage: "No se pudo completar el health check.",
} as const;
