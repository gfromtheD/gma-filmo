import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreatorBySlug, getCreatorFilmsByTitulos } from "@/lib/supabase/queries";
import { CreatorProfilePage } from "@/components/features/creator/creator-profile";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = await getCreatorBySlug(params.slug);
  if (!creator) return { title: "Creador" };
  return { title: `${creator.nombre} — GMA Filmo` };
}

export default async function CreatorPage({ params }: Props) {
  const creator = await getCreatorBySlug(params.slug);
  if (!creator) notFound();

  const films = await getCreatorFilmsByTitulos(creator.titulos);

  return <CreatorProfilePage creator={creator} films={films} />;
}
