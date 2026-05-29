import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPeliculaBySlug, getRelatedPeliculas } from "@/lib/supabase/queries";
import { PlayerScreen } from "@/components/features/player/player-screen";

interface Props {
  params: { id: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPeliculaBySlug(params.id);
  return { title: item?.title ?? "Reproduciendo" };
}

export default async function PlayerPage({ params }: Props) {
  const item = await getPeliculaBySlug(params.id);
  if (!item) notFound();
  const [nextItem] = await getRelatedPeliculas(params.id, item.categories, 1, { author: item.author, year: item.year });
  return <PlayerScreen item={item} nextItem={nextItem} />;
}
