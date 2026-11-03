-- ── La «Sinopsis corta» de Studio pasa a ser la frase corta del título ───────
-- Decisión de G (3/11/2026). Al copiar la ficha a un título publicado, `peliculas.tagline` toma `ficha.synopsisShort`
-- (recortada a 180 caracteres; vacía = NULL, así la web usa el respaldo). Mismo cuerpo que en 20261021000100 más ese UPDATE.
-- Idempotente (CREATE OR REPLACE).

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
  UPDATE peliculas SET tagline = left(NULLIF(trim(f.ficha->>'synopsisShort'), ''), 180) WHERE id = film.id;
  RETURN jsonb_build_object('pelicula_id', film.id, 'copied', true);
END $$;

REVOKE ALL ON FUNCTION public.gma_draft_ficha_publish(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gma_draft_ficha_publish(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
