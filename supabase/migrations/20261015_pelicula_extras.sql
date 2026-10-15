-- ── Extras de un título (making of, entrevistas, escenas eliminadas…) ─────────
-- Idempotente y solo aditiva. Lectura pública únicamente de los extras publicados;
-- la escritura se hace desde el servidor (service role) tras comprobar la autoría.
-- `provider` + `media_ref` dejan la tabla preparada para otros proveedores de medios.

CREATE TABLE IF NOT EXISTS pelicula_extras (
  id               bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pelicula_id      integer NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
  title            text    NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description      text    CHECK (description IS NULL OR char_length(description) <= 500),
  kind             text    NOT NULL DEFAULT 'otro'
                   CHECK (kind IN ('making_of','entrevista','escena_eliminada','detras_camaras','musica','galeria','otro')),
  provider         text    NOT NULL DEFAULT 'r2' CHECK (provider IN ('r2','stream','peertube','external')),
  video_url        text    NOT NULL CHECK (video_url ~ '^https://'),
  media_ref        text,
  poster_url       text    CHECK (poster_url IS NULL OR poster_url ~ '^https://'),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  file_size_bytes  bigint  CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  sort_order       integer NOT NULL DEFAULT 0,
  status           text    NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','hidden')),
  created_by       uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pelicula_extras_pelicula_idx ON pelicula_extras (pelicula_id, sort_order, id);

ALTER TABLE pelicula_extras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pelicula_extras' AND policyname = 'pelicula_extras_public_read'
  ) THEN
    CREATE POLICY pelicula_extras_public_read ON pelicula_extras FOR SELECT USING (status = 'published');
  END IF;
END $$;
