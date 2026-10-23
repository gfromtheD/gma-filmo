-- Banner de la ficha de creador por el motor de subidas.
-- Funciona como el avatar: un borrador con propósito `banner` admite un único recurso con rol `banner`;
-- la acción `banner` lo asigna a `creator_profiles.banner_url` y limpia el banner anterior.
-- Solo se reemplazan las funciones pequeñas: `gma_upload_command_v2_compat` y `_v3_compat` no cambian.
-- Idempotente: se puede aplicar dos veces.

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS banner_url text;

ALTER TABLE gma_upload_drafts DROP CONSTRAINT IF EXISTS gma_upload_drafts_purpose_check;
ALTER TABLE gma_upload_drafts ADD CONSTRAINT gma_upload_drafts_purpose_check CHECK (purpose IN ('title','avatar','banner'));

ALTER TABLE gma_media_assets DROP CONSTRAINT IF EXISTS gma_media_assets_role_check;
ALTER TABLE gma_media_assets ADD CONSTRAINT gma_media_assets_role_check
  CHECK (role IN ('main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar','banner'));

-- Un banner asignado a una ficha cuenta como referencia: no se puede cancelar ni borrar.
CREATE OR REPLACE FUNCTION public.gma_media_has_references(p_asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=p_asset_id)
 OR EXISTS(SELECT 1 FROM gma_title_media_versions v CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.snapshot->'media','[]'::jsonb)) m
           WHERE v.retained_until>now() AND m->>'asset_id'=p_asset_id::text)
 OR EXISTS(SELECT 1 FROM creator_profiles cp JOIN gma_media_assets a ON a.owner_id=cp.user_id AND a.delivery_path=cp.avatar_url WHERE a.id=p_asset_id)
 OR EXISTS(SELECT 1 FROM creator_profiles cp JOIN gma_media_assets a ON a.owner_id=cp.user_id AND a.delivery_path=cp.banner_url WHERE a.id=p_asset_id);
$function$;

-- El banner es público en cuanto la ficha de su dueño apunta a él, igual que el avatar.
CREATE OR REPLACE FUNCTION public.gma_media_authorize(p_asset_id uuid, p_owner uuid, p_title_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('id',a.id,'owner_id',a.owner_id,'provider',a.provider,'role',a.role,'state',a.state,
   'duration_seconds',a.duration_seconds,'expected_input_bytes',a.expected_input_bytes,'received_bytes',a.received_bytes,
   'delivery_path',a.delivery_path,'verified_at',a.verified_at,
   'metadata',jsonb_strip_nulls(jsonb_build_object('width',a.metadata->'width','height',a.metadata->'height','syntheticPlayback',a.metadata->'syntheticPlayback')))
 INTO result FROM gma_media_assets a
 WHERE a.id=p_asset_id AND a.state='ready'
 AND (
   (p_owner IS NOT NULL AND a.owner_id=p_owner AND (
     EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id
       WHERE dm.asset_id=a.id AND dm.owner_id=p_owner AND d.owner_id=p_owner AND d.state='draft')
     OR EXISTS(SELECT 1 FROM gma_title_media tm JOIN peliculas p ON p.id=tm.title_id
       WHERE tm.asset_id=a.id AND tm.owner_id=p_owner AND p.creator_user_id=p_owner AND p.media_delete_state='none'
         AND p.status IN ('published','unpublished') AND (p_title_slug IS NULL OR p.slug=p_title_slug))
   ))
   OR EXISTS(SELECT 1 FROM gma_title_media tm JOIN peliculas p ON p.id=tm.title_id
      WHERE tm.asset_id=a.id AND tm.owner_id=a.owner_id AND p.creator_user_id=a.owner_id AND p.media_delete_state='none'
        AND (p.status='published' OR (p.status IS NULL AND p.playback_kind='legacy' AND a.provider IN ('r2','stream')))
        AND (p_title_slug IS NULL OR p.slug=p_title_slug))
   OR (a.role='avatar' AND EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id=a.owner_id AND cp.avatar_url=a.delivery_path))
   OR (a.role='banner' AND EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id=a.owner_id AND cp.banner_url=a.delivery_path))
 );
 IF result IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN result;
END $function$;

-- Reserva: rol `banner` de hasta 10 MiB, solo en borradores `banner` y solo para quien ya tiene ficha de creador.
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
   WHEN 'banner' THEN 10485760 ELSE 0 END;
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
 slot_name=CASE WHEN r='extras' THEN 'extras:'||(p_payload->>'idempotency_key') WHEN r='subtitles' THEN 'subtitles:'||COALESCE(NULLIF(p_payload->>'language',''),'und') ELSE r END;
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

-- Envoltorio público: acción `banner` (asignar) y borrado de cuenta que también vacía el banner.
CREATE OR REPLACE FUNCTION public.gma_upload_command(p_owner uuid, p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE film peliculas; hash text; key uuid; result jsonb; d gma_upload_drafts; a gma_media_assets; s gma_upload_sessions;
BEGIN
 IF p_action='retire' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   hash=md5(p_owner::text||':'||film.id::text||':legacy-retire');
   key=(substr(hash,1,8)||'-'||substr(hash,9,4)||'-'||substr(hash,13,4)||'-'||substr(hash,17,4)||'-'||substr(hash,21,12))::uuid;
   PERFORM gma_title_command(p_owner,'delete',jsonb_build_object('title_id',film.id,'expected_revision',film.media_revision,'idempotency_key',key,'request_hash',repeat(hash,2)));
   RETURN jsonb_build_object('ok',true);
 ELSIF p_action='edit_title' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF film.media_delete_state<>'none' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 ELSIF p_action='banner' THEN
   IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   -- Mismo orden de bloqueo que el resto de comandos: primero la cuota global, después el borrador.
   INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
   PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
   SELECT * INTO d FROM gma_upload_drafts WHERE id=(p_payload->>'draft_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF d.purpose<>'banner' OR NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   SELECT a1.* INTO a FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.draft_id=d.id AND m.role='banner';
   IF NOT FOUND OR a.state<>'ready' THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   SELECT us.* INTO s FROM gma_upload_sessions us JOIN gma_media_assets ma ON ma.id=us.asset_id
     JOIN creator_profiles cp ON cp.banner_url=ma.delivery_path AND cp.user_id=p_owner WHERE us.owner_id=p_owner;
   UPDATE creator_profiles SET banner_url=a.delivery_path WHERE user_id=p_owner;
   UPDATE gma_upload_drafts SET state='published',revision=revision+1 WHERE id=d.id;
   -- El banner anterior subido por el motor deja de estar en uso y se limpia; un banner antiguo (URL de R2) no tiene sesión.
   IF s.id IS NOT NULL AND s.asset_id<>a.id THEN
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END IF;
   RETURN to_jsonb(a);
 ELSIF p_action='delete_account' THEN
   UPDATE peliculas SET status='unpublished',media_delete_state='pending',media_revision=media_revision+CASE WHEN status='published' THEN 1 ELSE 0 END WHERE creator_user_id=p_owner AND media_delete_state='none';
   UPDATE gma_title_media_versions SET retained_until=now() WHERE owner_id=p_owner;
   DELETE FROM gma_title_media WHERE owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=NULL,banner_url=NULL WHERE user_id=p_owner;
   RETURN gma_upload_command_v3_compat(p_owner,p_action,p_payload);
 ELSIF p_action='purge_account' THEN
   DELETE FROM gma_media_command_results WHERE owner_id=p_owner;
   DELETE FROM gma_title_media_versions WHERE owner_id=p_owner;
 END IF;
 RETURN gma_upload_command_v3_compat(p_owner,p_action,p_payload);
END $function$;
