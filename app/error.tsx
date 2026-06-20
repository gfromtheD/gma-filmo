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

  if (msg.includes("not found") || msg.includes("404"))
    return {
      code: "404",
      title: "No encontrado",
      description: "El recurso que buscas no existe o ha sido eliminado.",
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
    title: "Algo fue mal",
    description: "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.",
  };
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { code, title, description } = resolveError(error);

  return (
    <ErrorScreen
      code={code}
      title={title}
      description={description}
      buttons={[
        { label: "Reintentar",   onClick: reset,                                  variant: "solid",   icon: "retry" },
        { label: "Ir al inicio", onClick: () => { window.location.href = "/"; },  variant: "outline", icon: "home"  },
      ]}
    />
  );
}
