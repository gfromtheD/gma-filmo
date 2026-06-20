"use client";

import { ErrorScreen } from "@/components/error-screen";

function resolveError(error: Error): { code: string; title: string; description: string } {
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("unauthorized") || msg.includes("401"))
    return {
      code: "401",
      title: "No autorizado",
      description: "No tienes permiso para acceder a este contenido. Inicia sesión e inténtalo de nuevo.",
    };

  if (msg.includes("forbidden") || msg.includes("403"))
    return {
      code: "403",
      title: "Acceso denegado",
      description: "Tu cuenta no tiene permisos para ver esta sección.",
    };

  if (msg.includes("timeout") || msg.includes("timed out"))
    return {
      code: "408",
      title: "Tiempo de espera agotado",
      description: "La solicitud tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.",
    };

  if (msg.includes("fetch") || msg.includes("network") || msg.includes("conexión"))
    return {
      code: "503",
      title: "Sin conexión",
      description: "No se pudo conectar con el servidor. Comprueba tu red e inténtalo de nuevo.",
    };

  return {
    code: "500",
    title: "Error crítico",
    description: "Ha ocurrido un error grave en la aplicación. Por favor, recarga la página.",
  };
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { code, title, description } = resolveError(error);

  return (
    <html lang="es">
      <body style={{ margin: 0 }}>
        <ErrorScreen
          code={code}
          title={title}
          description={description}
          buttons={[
            { label: "Reintentar",   onClick: reset,                                  variant: "solid",   icon: "retry" },
            { label: "Ir al inicio", onClick: () => { window.location.href = "/"; },  variant: "outline", icon: "home"  },
          ]}
        />
      </body>
    </html>
  );
}
