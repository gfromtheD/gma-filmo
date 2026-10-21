-- ── Audiencia real del panel de Mi Estudio ─────────────────────────────────────────────────────────────────────────
-- Idempotente. Devuelve, para un creador, exactamente lo que el panel dice contar:
--   · Espectadores: PERSONAS distintas (cuentas, no perfiles) con progreso de visionado en alguna obra del creador,
--     incluido el propio creador. El total NO suma las cifras por obra: quien ve dos obras cuenta una vez.
--   · Por obra: espectadores distintos de esa obra.
--   · Valoración: media de `ratings.score` y número de votos de cada obra.
--   · Comentarios: comentarios no borrados (raíz y respuestas) de cada obra.
--   · Por mes: personas distintas cuyo último visionado cayó en ese mes (últimos 6, el actual incluido).
-- Solo la ejecuta el servidor (service_role), tras autenticar al usuario.
CREATE OR REPLACE FUNCTION gma_creator_audience(p_owner uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (SELECT id, slug FROM peliculas WHERE creator_user_id = p_owner),
  per_title AS (
    SELECT m.slug,
      (SELECT count(DISTINCT v.user_id) FROM view_history v WHERE v.pelicula_id = m.id) AS viewers,
      (SELECT avg(r.score) FROM ratings r WHERE r.pelicula_id = m.id AND r.score IS NOT NULL) AS rating_avg,
      (SELECT count(*) FROM ratings r WHERE r.pelicula_id = m.id AND r.score IS NOT NULL) AS rating_count,
      (SELECT count(*) FROM comments c WHERE c.pelicula_id = m.id AND NOT c.is_deleted) AS comments
    FROM mine m
  ),
  months AS (
    SELECT date_trunc('month', now()) - (n || ' month')::interval AS start FROM generate_series(0, 5) AS n
  )
  SELECT jsonb_build_object(
    'titles', COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'viewers', viewers,
        'ratingAvg', rating_avg, 'ratingCount', rating_count, 'comments', comments)) FROM per_title), '[]'::jsonb),
    'totalViewers', (SELECT count(DISTINCT v.user_id) FROM view_history v JOIN mine m ON m.id = v.pelicula_id),
    'monthly', (SELECT jsonb_agg(jsonb_build_object('month', to_char(mo.start, 'YYYY-MM'),
        'viewers', (SELECT count(DISTINCT v.user_id) FROM view_history v JOIN mine m ON m.id = v.pelicula_id
                    WHERE v.last_watched_at >= mo.start AND v.last_watched_at < mo.start + interval '1 month')) ORDER BY mo.start)
      FROM months mo)
  );
$$;
REVOKE ALL ON FUNCTION gma_creator_audience(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gma_creator_audience(uuid) TO service_role;
