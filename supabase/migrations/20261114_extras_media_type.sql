-- ── Tipo de archivo explícito de los extras (vídeo o imagen) ─────────────────
-- Hasta ahora el tipo se deducía de la extensión de la URL; con claves opacas (motor de subidas) esa deducción falla.
-- Idempotente y aditiva: `media_type` ('video' | 'image'), por defecto 'video'. Las filas existentes cuyo archivo es una imagen
-- (por extensión) se marcan como 'image'. La web usa esta columna y deja la extensión solo como respaldo.

ALTER TABLE pelicula_extras ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video'
  CHECK (media_type IN ('video', 'image'));

UPDATE pelicula_extras SET media_type = 'image'
  WHERE media_type = 'video' AND video_url ~* '\.(jpe?g|png|webp|avif|gif)([?#].*)?$';
