-- Defensa en profundidad en pelicula_extras: escribir solo desde el servidor (la RLS ya lo impedía) y que la lectura pública
-- no enseñe quién lo subió. Idempotente. EXTRA_COLUMNS (lib/extras/queries.ts) ya no pide `created_by`.
REVOKE INSERT, UPDATE, DELETE ON public.pelicula_extras FROM anon, authenticated;
REVOKE SELECT ON public.pelicula_extras FROM anon, authenticated;
GRANT SELECT (id, pelicula_id, title, description, kind, provider, video_url, media_ref, poster_url, duration_seconds,
  file_size_bytes, sort_order, status, media_type, created_at, updated_at) ON public.pelicula_extras TO anon, authenticated;
