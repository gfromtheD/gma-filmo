-- Metadatos por extra del motor: nombre, descripción, orden y ocultar. El archivo (gma_title_media) no cambia nunca;
-- esto solo es lo que el creador escribe sobre él. Cerrada a anon/authenticated: se lee y escribe desde el servidor.
CREATE TABLE IF NOT EXISTS public.gma_extra_meta (
  title_id    bigint      NOT NULL REFERENCES public.peliculas(id) ON DELETE CASCADE,
  asset_id    uuid        NOT NULL,
  label       text        CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 120),
  description text        CHECK (description IS NULL OR char_length(description) <= 500),
  hidden      boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (title_id, asset_id)
);
ALTER TABLE public.gma_extra_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gma_extra_meta FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gma_extra_meta TO service_role;
