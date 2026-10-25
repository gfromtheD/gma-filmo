-- Espacio del equipo (docs/DIRECTORES-GESTIONADOS.md): las cuentas que el equipo lleva en nombre de un autor tienen su
-- propio cupo y gastan de una bolsa del equipo, separada de los 5 GB gratis y del tope de los creadores.

ALTER TABLE public.gma_upload_policy ADD COLUMN IF NOT EXISTS staff_bytes bigint NOT NULL DEFAULT 64424509440 CHECK (staff_bytes > 0);
-- 5 GB gratis por creador (lo que promete la web; antes el servidor dejaba 10) y 60 GB para el equipo.
UPDATE public.gma_upload_policy SET user_bytes = 5368709120, staff_bytes = 64424509440 WHERE id = true;

CREATE TABLE IF NOT EXISTS public.gma_upload_quota_overrides (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_bytes bigint NOT NULL CHECK (user_bytes > 0),
  nota text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.gma_upload_quota_overrides IS
  'Cupo propio de las cuentas que lleva el equipo (gastan de la bolsa equipo). Sin políticas: solo servidor y editor SQL.';
ALTER TABLE public.gma_upload_quota_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gma_upload_quota_overrides FROM anon, authenticated;

-- Lo que el panel de Mi Estudio enseña como espacio total: el cupo real de la cuenta (excepción o el de la política).
CREATE OR REPLACE FUNCTION public.gma_my_storage_limit() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT user_bytes FROM gma_upload_quota_overrides WHERE owner_id = auth.uid()),
                  (SELECT user_bytes FROM gma_upload_policy WHERE id = true));
$$;
REVOKE ALL ON FUNCTION public.gma_my_storage_limit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gma_my_storage_limit() TO authenticated;

-- Pablo Parés: 12 GB (sus 4 películas suman unos 9 GB).
INSERT INTO public.gma_upload_quota_overrides (owner_id, user_bytes, nota)
SELECT id, 12884901888, 'Pablo Parés: filmografía subida por el equipo' FROM auth.users WHERE email = 'pablo-pares@gestionado.gma-filmo.invalid'
ON CONFLICT (owner_id) DO UPDATE SET user_bytes = EXCLUDED.user_bytes, nota = EXCLUDED.nota, updated_at = now();

CREATE OR REPLACE FUNCTION public.gma_media_reserve(p_owner uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s gma_upload_sessions; d gma_upload_drafts; pol gma_upload_policy; q gma_upload_quota; ov gma_upload_quota_overrides; pool text;
 r text; b bigint; sec integer; reserved_sec integer; chosen_provider text; cap bigint; slot_name text; k text; aid uuid;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO pol FROM gma_upload_policy WHERE id=true;
 -- Cuentas gestionadas por el equipo: su cupo propio y la bolsa del equipo, no los 5 GB ni el tope de los creadores.
 SELECT * INTO ov FROM gma_upload_quota_overrides WHERE owner_id=p_owner;
 pool=CASE WHEN ov.owner_id IS NULL THEN 'global' ELSE 'equipo' END;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_POLICY_UNAVAILABLE'; END IF;
 SELECT * INTO s FROM gma_upload_sessions WHERE owner_id=p_owner AND idempotency_key=p_payload->>'idempotency_key';
 IF FOUND THEN
   IF s.request_hash IS DISTINCT FROM p_payload->>'request_hash' OR s.draft_id IS DISTINCT FROM (p_payload->>'draft_id')::uuid
     OR s.role IS DISTINCT FROM p_payload->>'role'
     OR (p_payload ? 'bytes' AND s.expected_input_bytes IS DISTINCT FROM (p_payload->>'bytes')::bigint)
     OR (p_payload ? 'sha256' AND s.source_sha256 IS DISTINCT FROM p_payload->>'sha256')
     OR (p_payload ? 'file_name' AND s.file_name IS DISTINCT FROM p_payload->>'file_name')
     OR (p_payload ? 'content_type' AND s.content_type IS DISTINCT FROM p_payload->>'content_type')
     OR (p_payload ? 'language' AND s.language IS DISTINCT FROM p_payload->>'language')
   THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(s);
 END IF;
 IF EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_ACCOUNT_DELETING'; END IF;
 SELECT * INTO d FROM gma_upload_drafts WHERE id=(p_payload->>'draft_id')::uuid AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF d.state<>'draft' OR d.revision IS DISTINCT FROM (p_payload->>'revision')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF NOT pol.legacy_inventory_verified THEN RAISE EXCEPTION 'UPLOAD_LEGACY_INVENTORY_REQUIRED'; END IF;
 r=p_payload->>'role'; b=(p_payload->>'bytes')::bigint;
 cap=CASE r WHEN 'main' THEN pol.main_bytes WHEN 'trailer' THEN 1073741824 WHEN 'extras' THEN 1073741824 WHEN 'intro' THEN 524288000
   WHEN 'poster' THEN 10485760 WHEN 'poster_h' THEN 10485760 WHEN 'poster_v' THEN 10485760 WHEN 'subtitles' THEN 5242880 WHEN 'avatar' THEN 5242880
   WHEN 'banner' THEN 10485760 WHEN 'extra_image' THEN 10485760 ELSE 0 END;
 IF b IS NULL OR b<1 OR b>cap OR cap=0 OR COALESCE(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR COALESCE(length(p_payload->>'file_name'),0) NOT BETWEEN 1 AND 255 OR COALESCE(length(p_payload->>'content_type'),0) NOT BETWEEN 1 AND 100
   OR COALESCE(length(p_payload->>'idempotency_key'),0) NOT BETWEEN 1 AND 120 OR COALESCE(length(p_payload->>'request_hash'),0) NOT BETWEEN 1 AND 200
   OR (p_payload->>'language' IS NOT NULL AND p_payload->>'language' !~ '^[a-zA-Z0-9-]{2,35}$') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 -- Un borrador de perfil (avatar/banner) solo admite su propio rol; uno de título no admite ninguno de los dos.
 IF (d.purpose IN ('avatar','banner') AND r<>d.purpose) OR (d.purpose='title' AND r IN ('avatar','banner'))
   OR ((d.purpose='title' OR r='banner') AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner)) THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 sec=CASE r WHEN 'main' THEN 14400 WHEN 'extras' THEN 3600 WHEN 'trailer' THEN 600 WHEN 'intro' THEN 300 ELSE 0 END;
 chosen_provider=CASE WHEN sec>0 THEN COALESCE(p_payload->>'video_provider','r2') ELSE COALESCE(p_payload->>'auxiliary_provider','r2') END;
 IF chosen_provider NOT IN ('r2','stream','mock','peertube') OR (sec=0 AND chosen_provider NOT IN ('r2','mock')) THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 reserved_sec=CASE WHEN chosen_provider='stream' THEN sec ELSE 0 END;
 slot_name=CASE WHEN r IN ('extras','extra_image') THEN r||':'||(p_payload->>'idempotency_key') WHEN r='subtitles' THEN 'subtitles:'||COALESCE(NULLIF(p_payload->>'language',''),'und') ELSE r END;
 IF EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND slot=slot_name) THEN RAISE EXCEPTION 'UPLOAD_SLOT_OCCUPIED'; END IF;
 -- Tope de extras (imágenes + vídeos) y de subtítulos por obra: el mismo que enseña Mi Estudio, aplicado también aquí.
 IF r IN ('extras','extra_image') AND (SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id AND role IN ('extras','extra_image'))>=12
   OR r='subtitles' AND (SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id AND role='subtitles')>=5 THEN RAISE EXCEPTION 'UPLOAD_SLOT_LIMIT'; END IF;
 IF (SELECT count(*) FROM gma_upload_sessions WHERE owner_id=p_owner AND state IN ('provisioning','uploading','paused'))>=pol.user_active_sessions THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
 -- Freno anti-prisas: una persona sube como mucho unos 20 archivos por obra; más de 30 reservas en un minuto es un script.
 IF (SELECT count(*) FROM gma_upload_sessions WHERE owner_id=p_owner AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'UPLOAD_RATE_LIMITED'; END IF;
 FOREACH k IN ARRAY ARRAY[pool,'owner:'||p_owner::text,'draft:'||d.id::text] LOOP
   INSERT INTO gma_upload_quota(account_key) VALUES(k) ON CONFLICT DO NOTHING;
   SELECT * INTO q FROM gma_upload_quota WHERE account_key=k FOR UPDATE;
   IF q.used_bytes+q.reserved_bytes+b>(CASE WHEN k='global' THEN pol.global_bytes WHEN k='equipo' THEN pol.staff_bytes WHEN k LIKE 'owner:%' THEN coalesce(ov.user_bytes,pol.user_bytes) ELSE pol.draft_bytes END)
     OR q.used_seconds+q.reserved_seconds+reserved_sec>(CASE WHEN k IN ('global','equipo') THEN pol.global_stream_seconds ELSE pol.user_stream_seconds END)
   THEN RAISE EXCEPTION 'UPLOAD_QUOTA_EXCEEDED'; END IF;
 END LOOP;
 INSERT INTO gma_media_assets(owner_id,role,provider,expected_input_bytes) VALUES(p_owner,r,chosen_provider,b) RETURNING id INTO aid;
 INSERT INTO gma_upload_sessions(owner_id,draft_id,asset_id,role,slot,language,provider,expected_input_bytes,source_sha256,content_type,file_name,max_duration_seconds,idempotency_key,request_hash)
 VALUES(p_owner,d.id,aid,r,slot_name,p_payload->>'language',chosen_provider,b,p_payload->>'sha256',p_payload->>'content_type',p_payload->>'file_name',sec,p_payload->>'idempotency_key',p_payload->>'request_hash') RETURNING * INTO s;
 IF chosen_provider='r2' AND sec>0 THEN UPDATE gma_upload_sessions SET object_key='ingest/'||p_owner||'/'||id||'/'||gen_random_uuid() WHERE id=s.id RETURNING * INTO s; END IF;
 INSERT INTO gma_draft_media VALUES(d.id,p_owner,aid,r,slot_name,s.language,(SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id));
 FOREACH k IN ARRAY ARRAY[pool,'owner:'||p_owner::text,'draft:'||d.id::text] LOOP
   UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes+b,reserved_seconds=reserved_seconds+reserved_sec WHERE account_key=k;
   INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'reserve',b,reserved_sec);
 END LOOP;
 -- La web prepara la subida en la misma petición; el ejecutor solo entra como respaldo si pasados 30 s no está hecho
 -- (antes competían los dos por el mismo turno y la web devolvía UPLOAD_PROVISION_RECOVERY_REQUIRED).
 PERFORM gma_upload_enqueue_job('provision',s.id,'{}','provision:'||s.id,now()+interval '30 seconds');
 UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
 RETURN to_jsonb(s);
END $function$;
