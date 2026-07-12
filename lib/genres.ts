export const CREATOR_GENRES = [
  { label: "Drama",           slug: "drama" },
  { label: "Thriller",        slug: "thriller" },
  { label: "Documental",      slug: "documental" },
  { label: "Experimental",    slug: "experimental" },
  { label: "Comedia",         slug: "comedia" },
  { label: "Terror",          slug: "terror" },
  { label: "Ciencia ficción", slug: "ciencia-ficcion" },
  { label: "Romance",         slug: "romance" },
  { label: "Animación",       slug: "animacion" },
] as const;

export type CreatorGenreSlug = typeof CREATOR_GENRES[number]["slug"];

export function genreLabelToSlug(label: string): string | undefined {
  return CREATOR_GENRES.find(g => g.label === label)?.slug;
}
