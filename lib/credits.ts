import type { MediaItem, MovieMedia } from "@/types/catalog";

/**
 * Nombre de la dirección de un título a partir de `artistas` (preferente) o del
 * campo libre `author`. Misma regla que usa el hero clásico; solo presentación.
 */
export function getDirectorName(item: MediaItem): string | null {
  if (item.kind !== "movie") return null;
  const movie: MovieMedia = item;

  if (movie.artistas && movie.artistas.length > 0) {
    return (
      movie.artistas.find((a) => /creador|director/i.test(a.role))?.name ??
      movie.artistas[0]?.name ??
      null
    );
  }
  if (!movie.author) return null;
  const created = movie.author.match(/Creado por:\s*([^;]+)/i);
  if (created) return created[1]?.trim() ?? null;
  const illustrated = movie.author.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
  if (illustrated) return illustrated[1]?.trim() ?? null;
  return movie.author.trim();
}
