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
  searchParams: { skip?: string; t?: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPeliculaBySlug(params.id);
  return { title: item?.title ?? "Reproduciendo" };
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const item = await getPeliculaBySlug(params.id);
  if (!item) notFound();

  const artistaSlugs = (item.artistas ?? [])
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  // IDs already visited — exclude them from the next-item calculation
  const skipList = (searchParams.skip ?? "").split(",").filter(Boolean);

  const [nextItem, creator] = await Promise.all([
    getRelatedPeliculas(params.id, item.categories, 1, {
      author: item.author,
      year: item.year,
      excludeSlugs: skipList,
    }).then(([first]) => first),
    getCreatorByArtistaSlugs(artistaSlugs),
  ]);

  // Build the URL the player will navigate to, carrying the updated skip list
  const nextSkip = [...skipList, params.id].join(",");
  const nextUrl = nextItem ? `/ver/${nextItem.id}?skip=${nextSkip}` : undefined;

  const initialTime = searchParams.t && !isNaN(Number(searchParams.t)) ? Number(searchParams.t) : undefined;

  return <PlayerScreen item={item} nextItem={nextItem} nextUrl={nextUrl} creator={creator} initialTime={initialTime} />;
}
