import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { getPeliculas } from "@/lib/supabase/queries";
import { withCommunityScores } from "@/lib/ratings/summary-server";

export const metadata: Metadata = { title: "Películas" };
export const revalidate = 60;

/** Películas: más de 40 minutos (criterio de la industria). Misma pantalla, filtros y fichas que los cortos. */
export default async function PeliculasPage() {
  const films = await getPeliculas();
  const items = await withCommunityScores(films);
  return (
    <Suspense>
      <CatalogScreen items={items} section="peliculas" />
    </Suspense>
  );
}
