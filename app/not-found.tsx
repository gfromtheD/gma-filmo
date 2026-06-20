"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Página no encontrada"
      description="La página que buscas no existe o ha sido movida a otra dirección."
      buttons={[
        { label: "Volver",      onClick: () => window.history.back(),          variant: "outline", icon: "back" },
        { label: "Ir al inicio", onClick: () => { window.location.href = "/"; }, variant: "solid",   icon: "home" },
      ]}
    />
  );
}
