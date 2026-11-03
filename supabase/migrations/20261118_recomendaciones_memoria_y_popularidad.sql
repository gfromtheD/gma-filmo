-- ── Recomendaciones: memoria de lo mostrado en la base y popularidad real ───────────────────────────────────────
-- Idempotente y aditiva.
--  1) `home_shown`: qué títulos se enseñaron en la portada a cada perfil, para que rote aunque cambie de navegador o borre los
--     datos del suyo. Hasta ahora solo estaba en `localStorage`. Solo la lee y escribe el servidor (RLS sin políticas).
--  2) `gma_popular_titles(p_days)`: personas distintas que vieron cada título en los últimos días (por defecto 7), a partir de
--     `view_history`. Es un agregado sin datos personales; solo lo ejecuta el servidor.

CREATE TABLE IF NOT EXISTS public.home_shown (
  user_id    uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_id text        NOT NULL DEFAULT '',
  item_id    text        NOT NULL,
  shown_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id, item_id)
);
CREATE INDEX IF NOT EXISTS home_shown_recent_idx ON public.home_shown (user_id, profile_id, shown_at DESC);
ALTER TABLE public.home_shown ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_shown FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gma_popular_titles(p_days integer DEFAULT 7)
RETURNS TABLE (pelicula_id bigint, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.pelicula_id, count(DISTINCT v.user_id) AS viewers
  FROM view_history v
  WHERE v.last_watched_at >= now() - make_interval(days => least(greatest(p_days, 1), 90))
  GROUP BY v.pelicula_id
  ORDER BY viewers DESC
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.gma_popular_titles(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gma_popular_titles(integer) TO service_role;
NOTIFY pgrst, 'reload schema';
