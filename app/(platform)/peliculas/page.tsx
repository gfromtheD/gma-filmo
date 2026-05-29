import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { getPeliculas, getColecciones } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Cortometrajes" };
export const revalidate = 60;

export default async function MoviesPage() {
  const [items, colecciones] = await Promise.all([getPeliculas(), getColecciones()]);
  return (
    <Suspense>
      <CatalogScreen items={items} heading="Cortometrajes" colecciones={colecciones} />
    </Suspense>
  );
}
