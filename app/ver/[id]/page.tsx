import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPeliculaBySlug,
  getRelatedPeliculas,
  getCreatorByArtistaSlugs,
} from "@/lib/supabase/queries";
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

  const artistaSlugs = (item.artistas ?? [])
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  const [nextItem, creator] = await Promise.all([
    getRelatedPeliculas(params.id, item.categories, 1, {
      author: item.author,
      year: item.year,
    }).then(([first]) => first),
    getCreatorByArtistaSlugs(artistaSlugs),
  ]);

  return <PlayerScreen item={item} nextItem={nextItem} creator={creator} />;
}
