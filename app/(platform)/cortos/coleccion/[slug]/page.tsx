import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { ComingSoonScreen } from "@/components/features/catalog/coming-soon-screen";
import { getColeccionBySlug, getPeliculasByColeccion } from "@/lib/supabase/queries";
import { withCommunityScores } from "@/lib/ratings/summary-server";

export const revalidate = 60;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const col = await getColeccionBySlug(params.slug);
  return { title: col?.name ?? "Colección no encontrada" };
}

export default async function ColeccionPage({ params }: Props) {
  const [col, films] = await Promise.all([
    getColeccionBySlug(params.slug),
    getPeliculasByColeccion(params.slug),
  ]);

  if (!col) notFound();
  const items = await withCommunityScores(films);

  // Colecciones aún sin cortos → banner "Próximamente" (como en /peliculas)
  if (items.length === 0) {
    return <ComingSoonScreen title={col.name} />;
  }

  return (
    <Suspense>
      <CatalogScreen items={items} heading={col.name} backHref="/cortos" />
    </Suspense>
  );
}
