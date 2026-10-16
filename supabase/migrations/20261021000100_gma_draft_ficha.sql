-- Ficha completa del borrador de Mi Estudio (Windows) junto al motor multimedia (Mac).
-- Aditiva e idempotente: no modifica tablas existentes ni datos.
--
-- Por qué: el borrador del motor (`gma_upload_drafts.metadata`) solo admite título, sinopsis, año, idioma y género,
-- pero la pasarela de Windows recoge muchos más campos (título original, duración, país, categorías, edad, equipo,
-- premios, temas, aviso de IA, comentarios, extras…). Esta migración guarda la ficha completa, validada y versionada,
-- sin tocar el contrato publicado del motor:
--   * gma_draft_ficha: ficha del borrador, con revisión propia (CAS) y solo escribible por service_role.
--   * pelicula_ficha:  ficha del título una vez publicado, copiada desde el borrador por el servidor.
-- Cómo se muestran estos datos en la web pública es una decisión pendiente: pelicula_ficha solo es legible si el título
-- es visible (misma regla que `gma_title_visibility`).
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.gma_upload_drafts') IS NULL OR to_regclass('public.peliculas') IS NULL THEN
    RAISE EXCEPTION 'GMA_FICHA_PREFLIGHT: aplicar antes 20261005_upload_engine_v2';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gma_draft_ficha (
  draft_id uuid PRIMARY KEY REFERENCES public.gma_upload_drafts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version BETWEEN 1 AND 100),
  ficha jsonb NOT NULL CHECK (jsonb_typeof(ficha) = 'object' AND octet_length(ficha::text) <= 65536),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gma_draft_ficha_owner_idx ON public.gma_draft_ficha(owner_id);

CREATE TABLE IF NOT EXISTS public.pelicula_ficha (
  pelicula_id bigint PRIMARY KEY REFERENCES public.peliculas(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version BETWEEN 1 AND 100),
  ficha jsonb NOT NULL CHECK (jsonb_typeof(ficha) = 'object' AND octet_length(ficha::text) <= 65536),
  source_draft_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gma_draft_ficha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelicula_ficha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gma_draft_ficha, public.pelicula_ficha FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gma_draft_ficha TO authenticated;
GRANT SELECT ON public.pelicula_ficha TO anon, authenticated;
GRANT ALL ON public.gma_draft_ficha, public.pelicula_ficha TO service_role;

DROP POLICY IF EXISTS gma_draft_ficha_owner_read ON public.gma_draft_ficha;
CREATE POLICY gma_draft_ficha_owner_read ON public.gma_draft_ficha FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS pelicula_ficha_visible_read ON public.pelicula_ficha;
CREATE POLICY pelicula_ficha_visible_read ON public.pelicula_ficha FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.peliculas p WHERE p.id = pelicula_id
          AND (p.status IS NULL OR p.status = 'published' OR p.creator_user_id = auth.uid()))
);

-- Guarda la ficha de un borrador propio y editable. CAS con la revisión de la ficha (no la del borrador del motor:
-- la ficha se autoguarda mucho más a menudo y no debe invalidar reservas de subida).
CREATE OR REPLACE FUNCTION public.gma_draft_ficha_save(p_owner uuid, p_draft_id uuid, p_expected_revision integer,
  p_schema_version integer, p_ficha jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d gma_upload_drafts; f gma_draft_ficha;
BEGIN
  IF p_owner IS NULL OR p_draft_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
  SELECT * INTO d FROM gma_upload_drafts WHERE id = p_draft_id AND owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  IF d.purpose <> 'title' OR d.state <> 'draft' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
  SELECT * INTO f FROM gma_draft_ficha WHERE draft_id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
    INSERT INTO gma_draft_ficha(draft_id, owner_id, schema_version, ficha, revision)
      VALUES (p_draft_id, p_owner, p_schema_version, p_ficha, 1) RETURNING * INTO f;
  ELSE
    IF f.revision <> p_expected_revision THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
    UPDATE gma_draft_ficha SET schema_version = p_schema_version, ficha = p_ficha, revision = revision + 1, updated_at = now()
      WHERE draft_id = p_draft_id RETURNING * INTO f;
  END IF;
  RETURN jsonb_build_object('draft_id', f.draft_id, 'revision', f.revision, 'schema_version', f.schema_version, 'updated_at', f.updated_at);
END $$;

-- Copia la ficha de un borrador ya publicado a su título. Idempotente; solo el propietario del borrador y del título.
CREATE OR REPLACE FUNCTION public.gma_draft_ficha_publish(p_owner uuid, p_draft_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d gma_upload_drafts; f gma_draft_ficha; film peliculas;
BEGIN
  SELECT * INTO d FROM gma_upload_drafts WHERE id = p_draft_id AND owner_id = p_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  IF d.state <> 'published' OR d.title_id IS NULL THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
  SELECT * INTO film FROM peliculas WHERE id = d.title_id AND creator_user_id = p_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
  SELECT * INTO f FROM gma_draft_ficha WHERE draft_id = p_draft_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('pelicula_id', film.id, 'copied', false); END IF;
  INSERT INTO pelicula_ficha(pelicula_id, schema_version, ficha, source_draft_id, updated_at)
    VALUES (film.id, f.schema_version, f.ficha, p_draft_id, now())
    ON CONFLICT (pelicula_id) DO UPDATE SET schema_version = EXCLUDED.schema_version, ficha = EXCLUDED.ficha,
      source_draft_id = EXCLUDED.source_draft_id, updated_at = now();
  RETURN jsonb_build_object('pelicula_id', film.id, 'copied', true);
END $$;

REVOKE ALL ON FUNCTION public.gma_draft_ficha_save(uuid, uuid, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gma_draft_ficha_publish(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gma_draft_ficha_save(uuid, uuid, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gma_draft_ficha_publish(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
