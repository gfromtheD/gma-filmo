import { z } from 'zod';

/**
 * Ficha completa de un título (lo que pide la pasarela de Mi Estudio además de los archivos).
 * Se guarda en `gma_draft_ficha` / `pelicula_ficha` (migración 20261021000100). El servidor la valida aquí:
 * no confía en los límites del navegador, solo en este esquema.
 *
 * Los archivos NO van en la ficha: viven en el motor (`gma_draft_media`) y se referencian por `mediaId`.
 * `schemaVersion` permite evolucionar la ficha sin perder borradores antiguos.
 */
export const FICHA_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().trim().max(max);
const list = (item: z.ZodType<string>, max: number) => z.array(item).max(max);

export const fichaSchema = z.object({
  originalTitle: text(160),
  durationMinutes: z.number().int().positive().max(24 * 60).nullable(),
  productionCountry: z.string().regex(/^([A-Z]{2})?$/),
  releaseYear: z.number().int().min(1895).max(2100).nullable(),
  categories: list(text(60), 12),
  ageRating: text(40),
  firstFilm: z.boolean(),
  language: z.string().regex(/^([a-z]{2,3}(-[A-Za-z0-9]{2,8})?)?$/),
  synopsisShort: text(250),
  synopsisLong: text(10000),
  genres: list(text(60), 12),
  themes: list(text(60), 20),
  team: z.array(z.object({ name: text(120), role: text(60) }).strict()).max(60),
  awards: z.array(z.object({ festival: text(160), award: text(160) }).strict()).max(40),
  ai: z.object({ used: z.boolean(), note: text(1000) }).strict(),
  allowComments: z.boolean(),
  /** Idioma de cada subtítulo, en el orden de la pasarela (los archivos están en el motor). */
  subtitleLanguages: list(z.string().regex(/^[a-zA-Z0-9-]{2,35}$/), 10),
  /** Extras en orden: tipo y, si ya está en el motor, su medio. Los de imagen esperan una decisión de producto. */
  extras: z.array(z.object({
    kind: z.enum(['fotograma', 'poster', 'video']),
    mediaId: z.string().uuid().nullable(),
  }).strict()).max(12),
  /** Aceptación de condiciones: el servidor anota cuándo la recibió, no el navegador. */
  acceptedTerms: z.boolean(),
}).strict();

export type Ficha = z.infer<typeof fichaSchema>;

export const saveFichaSchema = z.object({
  revision: z.number().int().nonnegative(),
  schemaVersion: z.literal(FICHA_SCHEMA_VERSION),
  ficha: fichaSchema,
}).strict();
