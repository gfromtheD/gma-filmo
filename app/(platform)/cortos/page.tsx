import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { getPeliculas, getColecciones } from "@/lib/supabase/queries";
import { withCommunityScores } from "@/lib/ratings/summary-server";

export const metadata: Metadata = { title: "Cortometrajes" };
export const revalidate = 60;

export default async function CortosPage() {
  const [films, colecciones] = await Promise.all([getPeliculas(), getColecciones()]);
  const items = await withCommunityScores(films);
  return (
    <Suspense>
      <CatalogScreen items={items} heading="Cortometrajes" colecciones={colecciones} />
    </Suspense>
  );
}
