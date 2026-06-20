import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import {
  getPeliculaBySlug,
  getRelatedPeliculas,
  getCreatorByArtistaSlugs,
} from "@/lib/supabase/queries";

export const revalidate = 3600;

interface Props {
  params: { id: string };
  searchParams: { valorar?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getPeliculaBySlug(params.id);
  return { title: movie?.title ?? "Cortometraje" };
}

export default async function CortoDetailPage({ params, searchParams }: Props) {
  const movie = await getPeliculaBySlug(params.id);
  if (!movie) notFound();

  const artistaSlugs = (movie.artistas ?? [])
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  const [related, creator] = await Promise.all([
    getRelatedPeliculas(movie.id, movie.categories, 4, {
      author: movie.author,
      year: movie.year,
    }),
    getCreatorByArtistaSlugs(artistaSlugs),
  ]);

  return (
    <MovieDetail
      movie={movie}
      related={related}
      creator={creator}
      autoOpenRating={searchParams.valorar === "1"}
    />
  );
}
