-- ── Medias de valoraciones calculadas en la base ─────────────────────────────
-- Hasta ahora la web leía TODAS las valoraciones por páginas y calculaba las medias en el servidor. Esta función las agrega
-- en la base (una fila por título con votos). Misma regla que `summarizeRatings`: solo score > 0, estrellas máx. 5, media
-- por 2 (escala 0–10) con un decimal. Solo la ejecuta el servidor (service_role). Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.community_rating_summaries()
RETURNS TABLE (pelicula_id bigint, average double precision, votes bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT r.pelicula_id,
         round((avg(least(r.score, 5)) * 2)::numeric, 1)::double precision AS average,
         count(*) AS votes
  FROM ratings r
  WHERE r.score > 0
  GROUP BY r.pelicula_id;
$$;

REVOKE ALL ON FUNCTION public.community_rating_summaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_rating_summaries() TO service_role;
NOTIFY pgrst, 'reload schema';
