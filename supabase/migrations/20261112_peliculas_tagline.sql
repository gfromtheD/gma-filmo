-- ── Frase corta del título (tagline) ─────────────────────────────────────────
-- Idempotente y aditiva: una columna opcional en `peliculas`.
--   tagline → frase que acompaña al título en la cabecera de la ficha y en el banner (máx. 180 caracteres).
-- Si está vacía, la web usa la frase del archivo estático `lib/data/film-taglines.ts` y, si tampoco hay, las primeras frases de la sinopsis.

ALTER TABLE peliculas ADD COLUMN IF NOT EXISTS tagline text
  CHECK (tagline IS NULL OR char_length(tagline) <= 180);
