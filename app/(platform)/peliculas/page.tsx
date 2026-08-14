import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/features/catalog/coming-soon-screen";

export const metadata: Metadata = { title: "Películas" };

export default function PeliculasPage() {
  return (
    <ComingSoonScreen
      title="Películas"
      description="Estamos preparando una selección de largometrajes. Vuelve pronto."
    />
  );
}
