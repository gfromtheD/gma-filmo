-- Función atómica: crea la película y (opcionalmente) su relación de género
-- en una única transacción de servidor. Solo el service_role puede ejecutarla.
CREATE OR REPLACE FUNCTION publish_creator_pelicula(
  p_slug text, p_title text, p_synopsis text, p_year text, p_duration text,
  p_author text, p_r2_video_url text, p_r2_poster_url text, p_r2_subtitle_url text,
  p_creator_user_id uuid, p_media_format text, p_language text,
  p_file_size_bytes bigint, p_genre_coleccion_id integer
) RETURNS peliculas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row peliculas;
BEGIN
  INSERT INTO peliculas (
    slug, title, synopsis, year, duration, author,
    r2_video_url, r2_poster_url, r2_subtitle_url,
    source_page, creator_user_id, genre, language,
    file_size_bytes, status
  ) VALUES (
    p_slug, p_title, p_synopsis, p_year, p_duration, p_author,
    p_r2_video_url, p_r2_poster_url, p_r2_subtitle_url,
    'studio_upload', p_creator_user_id, p_media_format, p_language,
    p_file_size_bytes, 'published'
  ) RETURNING * INTO v_row;

  IF p_genre_coleccion_id IS NOT NULL THEN
    INSERT INTO peliculas_colecciones (pelicula_id, coleccion_id)
    VALUES (v_row.id, p_genre_coleccion_id)
    ON CONFLICT (pelicula_id, coleccion_id) DO NOTHING;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION publish_creator_pelicula FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION publish_creator_pelicula TO service_role;
