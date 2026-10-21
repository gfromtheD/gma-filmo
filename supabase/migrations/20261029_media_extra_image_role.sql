-- ── Extras de imagen en el motor de subidas ───────────────────────────────────────────────────────────────────────
-- Idempotente. Nuevo rol `extra_image`: fotogramas y pósters de los extras de una obra. Se tratan como el resto de
-- imágenes (proveedor auxiliar, hasta 10 MiB, convertidas a WebP) y cada extra tiene su propio hueco en el borrador
-- (`extra_image:<clave>`, como `extras:<clave>` en los de vídeo), así que subir uno no sustituye a otro.
-- Cambia la restricción de roles y SOLO dos expresiones de gma_media_reserve (el resto es la definición de producción).
-- La publicación ya copia todos los archivos del borrador al título sin mirar el rol, así que no necesita cambios.

ALTER TABLE gma_media_assets DROP CONSTRAINT IF EXISTS gma_media_assets_role_check;
ALTER TABLE gma_media_assets ADD CONSTRAINT gma_media_assets_role_check
  CHECK (role IN ('main','trailer','extras','extra_image','intro','poster','poster_h','poster_v','subtitles','avatar','banner'));

CREATE OR REPLACE FUNCTION public.gma_media_reserve(p_owner uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s gma_upload_sessions; d gma_upload_drafts; pol gma_upload_policy; q gma_upload_quota;
 r text; b bigint; sec integer; reserved_sec integer; chosen_provider text; cap bigint; slot_name text; k text; aid uuid;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO pol FROM gma_upload_policy WHERE id=true;
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
 IF (SELECT count(*) FROM gma_upload_sessions WHERE owner_id=p_owner AND state IN ('provisioning','uploading','paused'))>=pol.user_active_sessions THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
 FOREACH k IN ARRAY ARRAY['global','owner:'||p_owner::text,'draft:'||d.id::text] LOOP
   INSERT INTO gma_upload_quota(account_key) VALUES(k) ON CONFLICT DO NOTHING;
   SELECT * INTO q FROM gma_upload_quota WHERE account_key=k FOR UPDATE;
   IF q.used_bytes+q.reserved_bytes+b>(CASE WHEN k='global' THEN pol.global_bytes WHEN k LIKE 'owner:%' THEN pol.user_bytes ELSE pol.draft_bytes END)
     OR q.used_seconds+q.reserved_seconds+reserved_sec>(CASE WHEN k='global' THEN pol.global_stream_seconds ELSE pol.user_stream_seconds END)
   THEN RAISE EXCEPTION 'UPLOAD_QUOTA_EXCEEDED'; END IF;
 END LOOP;
 INSERT INTO gma_media_assets(owner_id,role,provider,expected_input_bytes) VALUES(p_owner,r,chosen_provider,b) RETURNING id INTO aid;
 INSERT INTO gma_upload_sessions(owner_id,draft_id,asset_id,role,slot,language,provider,expected_input_bytes,source_sha256,content_type,file_name,max_duration_seconds,idempotency_key,request_hash)
 VALUES(p_owner,d.id,aid,r,slot_name,p_payload->>'language',chosen_provider,b,p_payload->>'sha256',p_payload->>'content_type',p_payload->>'file_name',sec,p_payload->>'idempotency_key',p_payload->>'request_hash') RETURNING * INTO s;
 IF chosen_provider='r2' AND sec>0 THEN UPDATE gma_upload_sessions SET object_key='ingest/'||p_owner||'/'||id||'/'||gen_random_uuid() WHERE id=s.id RETURNING * INTO s; END IF;
 INSERT INTO gma_draft_media VALUES(d.id,p_owner,aid,r,slot_name,s.language,(SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id));
 FOREACH k IN ARRAY ARRAY['global','owner:'||p_owner::text,'draft:'||d.id::text] LOOP
   UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes+b,reserved_seconds=reserved_seconds+reserved_sec WHERE account_key=k;
   INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'reserve',b,reserved_sec);
 END LOOP;
 PERFORM gma_upload_enqueue_job('provision',s.id,'{}','provision:'||s.id,now());
 UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
 RETURN to_jsonb(s);
END $function$;
