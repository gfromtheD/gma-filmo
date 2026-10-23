-- Cartel vertical de cada obra, aparte del banner. `r2_poster_url` guarda la imagen ancha (banner: Home, fondo de la ficha);
-- `r2_poster_vertical_url`, el cartel (Mis títulos, el cartel junto al título en la ficha, listas). Se mantiene sola desde
-- gma_title_media, así que publicar, restaurar o retirar una obra la deja siempre al día.
ALTER TABLE peliculas ADD COLUMN IF NOT EXISTS r2_poster_vertical_url text;

CREATE OR REPLACE FUNCTION public.gma_sync_vertical_poster(p_title_id bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE peliculas SET r2_poster_vertical_url = (
    SELECT a.delivery_path FROM gma_title_media m JOIN gma_media_assets a ON a.id = m.asset_id
    WHERE m.title_id = p_title_id AND m.role IN ('poster_v', 'poster') AND a.delivery_path IS NOT NULL
    ORDER BY CASE m.role WHEN 'poster_v' THEN 0 ELSE 1 END LIMIT 1)
  WHERE id = p_title_id;
$function$;

CREATE OR REPLACE FUNCTION public.gma_title_media_vertical_poster()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role IN ('poster_v', 'poster') THEN PERFORM gma_sync_vertical_poster(NEW.title_id); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.role IN ('poster_v', 'poster') THEN PERFORM gma_sync_vertical_poster(OLD.title_id); END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS gma_title_media_vertical_poster ON gma_title_media;
CREATE TRIGGER gma_title_media_vertical_poster AFTER INSERT OR UPDATE OR DELETE ON gma_title_media
  FOR EACH ROW EXECUTE FUNCTION gma_title_media_vertical_poster();

REVOKE ALL ON FUNCTION public.gma_sync_vertical_poster(bigint) FROM PUBLIC, anon, authenticated;

-- Obras ya publicadas con el motor.
SELECT gma_sync_vertical_poster(t.title_id) FROM (SELECT DISTINCT title_id FROM gma_title_media WHERE role IN ('poster_v', 'poster')) t;
