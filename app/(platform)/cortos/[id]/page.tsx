import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import {
  getPeliculaBySlug,
  getRelatedPeliculas,
  getCreatorByArtistaSlugs,
} from "@/lib/supabase/queries";
import { getExtrasByPeliculaId } from "@/lib/extras/queries";

export const revalidate = 3600;

interface Props {
  params: { id: string };
  searchParams: { valorar?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getPeliculaBySlug(params.id);
  return { title: movie?.title ?? "Título no encontrado" };
}

export default async function CortoDetailPage({ params, searchParams }: Props) {
  const movie = await getPeliculaBySlug(params.id);
  if (!movie) notFound();

  const artistaSlugs = [...(movie.artistas ?? [])]
    .sort((a, b) => Number(/director|creador/i.test(b.role)) - Number(/director|creador/i.test(a.role)))
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  const [related, creator, extras] = await Promise.all([
    getRelatedPeliculas(movie.id, movie.categories, 4, {
      author: movie.author,
      year: movie.year,
    }),
    getCreatorByArtistaSlugs(artistaSlugs),
    getExtrasByPeliculaId(movie.numericId),
  ]);

  return (
    <MovieDetail
      movie={movie}
      related={related}
      creator={creator}
      extras={extras}
      autoOpenRating={searchParams.valorar === "1"}
    />
  );
}
