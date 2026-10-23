import { z } from "zod";
import type { StudioData } from "@/components/features/studio/studio-types";

/**
 * Audiencia de un creador tal como la calcula `gma_creator_audience` (ver la migración 20261030):
 * espectadores = personas distintas (cuentas), valoración = media de votos, comentarios = no borrados.
 */
export const audienceSchema = z.object({
  titles: z.array(z.object({
    slug: z.string(),
    viewers: z.number().int().nonnegative(),
    ratingAvg: z.number().nullable(),
    ratingCount: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
  })),
  totalViewers: z.number().int().nonnegative(),
  monthly: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), viewers: z.number().int().nonnegative() })),
});

export type Audience = z.infer<typeof audienceSchema>;

/** Mezcla la audiencia real en los datos del estudio sin mutarlos. Las obras sin fila de audiencia se quedan a cero. */
export function applyAudience(data: StudioData, audience: Audience): StudioData {
  const bySlug = new Map(audience.titles.map((t) => [t.slug, t]));
  const titles = data.titles.map((t) => {
    const a = bySlug.get(t.id);
    return {
      ...t,
      views: a?.viewers ?? 0,
      rating: a?.ratingAvg ?? undefined,
      ratingCount: a?.ratingCount ?? 0,
      comments: a?.comments ?? 0,
    };
  });
  const rated = titles.filter((t) => t.rating !== undefined && t.ratingCount);
  const votes = rated.reduce((sum, t) => sum + (t.ratingCount ?? 0), 0);
  const avgRating = votes ? rated.reduce((sum, t) => sum + (t.rating ?? 0) * (t.ratingCount ?? 0), 0) / votes : null;
  return {
    ...data,
    titles,
    viewsTrend: audience.monthly.map((m) => ({ m: m.month, v: m.viewers })),
    creator: { ...data.creator, stats: { ...data.creator.stats, totalViews: audience.totalViewers, avgRating } },
  };
}
