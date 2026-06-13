import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import { getPeliculaBySlug, getRelatedPeliculas } from "@/lib/supabase/queries";

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

  const related = await getRelatedPeliculas(movie.id, movie.categories, 4, {
    author: movie.author,
    year: movie.year,
  });

  return (
    <MovieDetail
      movie={movie}
      related={related}
      autoOpenRating={searchParams.valorar === "1"}
    />
  );
}
