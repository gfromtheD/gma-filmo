import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import { getPeliculaBySlug, getRelatedPeliculas, getCreatorByArtistaSlugs } from "@/lib/supabase/queries";
import { getExtrasByPeliculaId } from "@/lib/extras/queries";
import { workPath } from "@/lib/catalog/work-path";

/** «También te puede gustar»: 3 filas de 4 en escritorio. */
const RELATED_COUNT = 15;

export type WorkSection = "cortos" | "peliculas";

export async function workMetadata(id: string): Promise<Metadata> {
  const movie = await getPeliculaBySlug(id);
  return { title: movie?.title ?? "Título no encontrado" };
}

/**
 * Ficha de una obra. La usan `/cortos/[id]` y `/peliculas/[id]`: es idéntica, solo cambia la ruta. Si alguien abre una
 * película por la ruta de cortos (o al revés) —enlaces antiguos, notificaciones— se le lleva a la ruta que le corresponde.
 */
export async function WorkDetailPage({ id, section, rate }: { readonly id: string; readonly section: WorkSection; readonly rate?: boolean }) {
  const movie = await getPeliculaBySlug(id);
  if (!movie) notFound();

  const rightPath = workPath(movie);
  if (!rightPath.startsWith(`/${section}/`)) redirect(rate ? `${rightPath}?valorar=1` : rightPath);

  const artistaSlugs = [...(movie.artistas ?? [])]
    .sort((a, b) => Number(/director|creador/i.test(b.role)) - Number(/director|creador/i.test(a.role)))
    .map((a) => a.slug)
    .filter((s): s is string => Boolean(s));

  const [related, creator, extras] = await Promise.all([
    getRelatedPeliculas(movie.id, movie.categories, RELATED_COUNT, {
      author: movie.author,
      year: movie.year,
    }),
    getCreatorByArtistaSlugs(artistaSlugs),
    getExtrasByPeliculaId(movie.numericId),
  ]);

  return <MovieDetail movie={movie} related={related} creator={creator} extras={extras} autoOpenRating={rate === true} />;
}
