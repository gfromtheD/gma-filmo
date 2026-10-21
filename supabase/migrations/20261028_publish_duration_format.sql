-- ── Publicación: duración legible y límite corto/película ─────────────────────────────────────────────────────────
-- Idempotente. Cambia SOLO dos expresiones (cada una en el alta y en la republicación) de la acción `publish` de gma_upload_command_v2_compat (el resto de la función
-- es la definición que había en producción):
--   1. `peliculas.duration` se escribe como las obras antiguas: «1h 02m», «9m 40s», «45s» (antes «62m», sin segundos).
--   2. `peliculas.genre`: «Película» si dura MÁS de 40 minutos (criterio de la industria: Academia, AFI, BFI: un corto
--      dura 40 minutos o menos); antes los 40:00 exactos contaban como película.
-- La duración sale del vídeo medido en el servidor, no de lo que escriba el usuario. La web decide /cortos o /peliculas
-- con `genre` (lib/catalog/work-path.ts).

CREATE OR REPLACE FUNCTION public.gma_upload_command_v2_compat(p_owner uuid, p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d gma_upload_drafts; s gma_upload_sessions; a gma_media_assets; q gma_upload_quota;
 pol gma_upload_policy; r text; b bigint; sec integer; cap bigint; slot_name text;
 sid uuid; aid uuid; k text; keys text[]; actual_sec bigint; result jsonb; film peliculas; old_asset uuid; chosen_provider text; reserved_sec integer;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 -- All quota writers acquire a global lock before owner/draft rows, in one order.
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO pol FROM gma_upload_policy WHERE id=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_POLICY_UNAVAILABLE'; END IF;
 IF p_action='edit_title' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF film.media_revision<>COALESCE((p_payload->>'revision')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   IF length(COALESCE(trim(p_payload->'metadata'->>'title'),'')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE peliculas SET title=p_payload->'metadata'->>'title',synopsis=p_payload->'metadata'->>'synopsis',year=p_payload->'metadata'->>'year',
     language=COALESCE(p_payload->'metadata'->>'language',language),media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   IF p_payload->'metadata'->>'genre' IS NOT NULL THEN
     DELETE FROM peliculas_colecciones WHERE pelicula_id=film.id AND coleccion_id IN (SELECT id FROM colecciones WHERE slug IN
       ('drama','thriller','documental','experimental','comedia','terror','ciencia-ficcion','romance','animacion'));
     INSERT INTO peliculas_colecciones(pelicula_id,coleccion_id) SELECT film.id,id FROM colecciones WHERE slug=(CASE p_payload->'metadata'->>'genre' WHEN 'Drama' THEN 'drama' WHEN 'Thriller' THEN 'thriller' WHEN 'Documental' THEN 'documental' WHEN 'Experimental' THEN 'experimental' WHEN 'Comedia' THEN 'comedia' WHEN 'Terror' THEN 'terror' WHEN 'Ciencia ficción' THEN 'ciencia-ficcion' WHEN 'Romance' THEN 'romance' WHEN 'Animación' THEN 'animacion' END);
   END IF;
   RETURN to_jsonb(film);
 END IF;
 IF p_action='delete_account' THEN
   INSERT INTO gma_upload_account_deletions(owner_id) VALUES(p_owner) ON CONFLICT DO NOTHING;
   UPDATE peliculas SET status='unpublished' WHERE creator_user_id=p_owner;
   DELETE FROM gma_title_media WHERE owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=NULL WHERE user_id=p_owner;
   FOR s IN SELECT * FROM gma_upload_sessions WHERE owner_id=p_owner AND NOT quota_released LOOP
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END LOOP;
   RETURN jsonb_build_object('pending',true);
 END IF;
 IF p_action='purge_account' THEN
   IF NOT EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner AND state='cleanup')
     OR EXISTS(SELECT 1 FROM gma_upload_sessions WHERE owner_id=p_owner AND NOT quota_released)
     THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   DELETE FROM gma_processing_attempts WHERE session_id IN (SELECT id FROM gma_upload_sessions WHERE owner_id=p_owner);
   DELETE FROM gma_upload_jobs WHERE session_id IN (SELECT id FROM gma_upload_sessions WHERE owner_id=p_owner);
   DELETE FROM gma_upload_ledger WHERE session_id IN (SELECT id FROM gma_upload_sessions WHERE owner_id=p_owner);
   DELETE FROM gma_draft_media WHERE owner_id=p_owner;
   DELETE FROM gma_upload_sessions WHERE owner_id=p_owner;
   DELETE FROM gma_upload_publications WHERE draft_id IN (SELECT id FROM gma_upload_drafts WHERE owner_id=p_owner);
   DELETE FROM gma_upload_drafts WHERE owner_id=p_owner;
   DELETE FROM gma_media_assets WHERE owner_id=p_owner;
   UPDATE gma_upload_account_deletions SET state='purged' WHERE owner_id=p_owner;
   RETURN jsonb_build_object('pending',true);
 END IF;
 IF EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) AND p_action NOT IN
   ('intent','bind','receipt','observe','cancel','delete_confirmed') THEN RAISE EXCEPTION 'UPLOAD_ACCOUNT_DELETING'; END IF;
 IF p_action='retire' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE peliculas SET status='unpublished',media_revision=media_revision+1 WHERE id=film.id;
   UPDATE gma_upload_drafts SET state='abandoned' WHERE title_id=film.id AND state='draft';
   DELETE FROM gma_title_media WHERE title_id=film.id;
   FOR s IN SELECT us.* FROM gma_upload_sessions us JOIN gma_upload_drafts dr ON dr.id=us.draft_id
     WHERE dr.title_id=film.id AND NOT us.quota_released LOOP
     IF NOT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) THEN
       PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
     END IF;
   END LOOP;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='create_draft' THEN
   IF p_payload->>'purpose'='title' AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner)
     THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   IF (SELECT count(*) FROM gma_upload_drafts WHERE owner_id=p_owner AND state='draft')>=20 THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
   INSERT INTO gma_upload_drafts(owner_id,purpose) VALUES(p_owner,p_payload->>'purpose') RETURNING * INTO d;
   IF p_payload->>'title_slug' IS NOT NULL THEN
     SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'title_slug' AND creator_user_id=p_owner;
     IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
     UPDATE gma_upload_drafts SET title_id=film.id,metadata=jsonb_build_object('title',film.title,'synopsis',film.synopsis,
       'year',film.year,'language',film.language,'base_title_revision',film.media_revision) WHERE id=d.id RETURNING * INTO d;
   END IF;
   RETURN to_jsonb(d);
 END IF;
 IF p_action IN ('intent','bind','receipt','observe','cancel','pause','delete_confirmed','label_subtitle') THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   SELECT * INTO d FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
   SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
 ELSE
   SELECT * INTO d FROM gma_upload_drafts WHERE id=(p_payload->>'draft_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 END IF;
 IF p_action='publish' AND EXISTS(SELECT 1 FROM gma_upload_publications WHERE draft_id=d.id) THEN
   IF NOT EXISTS(SELECT 1 FROM gma_upload_publications WHERE draft_id=d.id AND request_hash=p_payload->>'request_hash')
     THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   SELECT * INTO film FROM peliculas WHERE id=(SELECT title_id FROM gma_upload_publications WHERE draft_id=d.id);
   RETURN to_jsonb(film);
 END IF;
 IF p_action IN ('update_draft','reserve','publish','reorder','label_subtitle') AND d.state<>'draft' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='reserve' THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE owner_id=p_owner AND idempotency_key=p_payload->>'idempotency_key';
   IF FOUND THEN
     IF s.request_hash<>p_payload->>'request_hash' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     RETURN to_jsonb(s);
   END IF;
 END IF;
 IF p_action IN ('update_draft','reserve','publish','reorder','label_subtitle') AND d.revision<>COALESCE((p_payload->>'revision')::integer,-1)
   THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='update_draft' THEN
   UPDATE gma_upload_drafts SET metadata=(p_payload->'metadata')||CASE WHEN metadata ? 'base_title_revision' THEN jsonb_build_object('base_title_revision',metadata->'base_title_revision') ELSE '{}'::jsonb END,revision=revision+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
   RETURN to_jsonb(d);
 ELSIF p_action='reserve' THEN
   IF NOT pol.legacy_inventory_verified THEN RAISE EXCEPTION 'UPLOAD_LEGACY_INVENTORY_REQUIRED'; END IF;
   r=p_payload->>'role'; b=(p_payload->>'bytes')::bigint;
   cap=CASE r WHEN 'main' THEN pol.main_bytes WHEN 'trailer' THEN 1073741824 WHEN 'extras' THEN 1073741824
     WHEN 'intro' THEN 524288000 WHEN 'poster' THEN 10485760 WHEN 'poster_h' THEN 10485760 WHEN 'poster_v' THEN 10485760
     WHEN 'subtitles' THEN 5242880 WHEN 'avatar' THEN 5242880 ELSE 0 END;
   IF b IS NULL OR cap=0 OR b<1 OR b>cap OR COALESCE(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
      OR length(p_payload->>'idempotency_key') NOT BETWEEN 1 AND 120
      OR length(p_payload->>'file_name') NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF (d.purpose='avatar')<>(r='avatar') OR (d.purpose='title' AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner))
     THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   sec=CASE r WHEN 'main' THEN 14400 WHEN 'extras' THEN 3600 WHEN 'trailer' THEN 600 WHEN 'intro' THEN 300 ELSE 0 END;
   chosen_provider=CASE WHEN sec>0 THEN COALESCE(p_payload->>'video_provider','r2') ELSE 'r2' END;
   IF chosen_provider NOT IN ('r2','stream') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   reserved_sec=CASE WHEN chosen_provider='stream' THEN sec ELSE 0 END;
   slot_name=CASE WHEN r='extras' THEN 'extras:'||(p_payload->>'idempotency_key')
     WHEN r='subtitles' THEN 'subtitles:'||COALESCE(NULLIF(p_payload->>'language',''),'und') ELSE r END;
   IF EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND slot=slot_name) THEN RAISE EXCEPTION 'UPLOAD_SLOT_OCCUPIED'; END IF;
   IF (SELECT count(*) FROM gma_upload_sessions WHERE owner_id=p_owner AND state IN ('provisioning','uploading','paused'))>=pol.user_active_sessions
     THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
   keys=ARRAY['global','owner:'||p_owner::text,'draft:'||d.id::text];
   FOREACH k IN ARRAY keys LOOP
     INSERT INTO gma_upload_quota(account_key) VALUES(k) ON CONFLICT DO NOTHING;
     SELECT * INTO q FROM gma_upload_quota WHERE account_key=k FOR UPDATE;
     IF q.used_bytes+q.reserved_bytes+b>(CASE WHEN k='global' THEN pol.global_bytes WHEN k LIKE 'owner:%' THEN pol.user_bytes ELSE pol.draft_bytes END)
       OR q.used_seconds+q.reserved_seconds+reserved_sec>(CASE WHEN k='global' THEN pol.global_stream_seconds ELSE pol.user_stream_seconds END)
       THEN RAISE EXCEPTION 'UPLOAD_QUOTA_EXCEEDED'; END IF;
   END LOOP;
   INSERT INTO gma_media_assets(owner_id,role,provider,expected_input_bytes)
     VALUES(p_owner,r,chosen_provider,b) RETURNING id INTO aid;
   INSERT INTO gma_upload_sessions(owner_id,draft_id,asset_id,role,slot,language,provider,expected_input_bytes,source_sha256,
     content_type,file_name,max_duration_seconds,idempotency_key,request_hash)
   VALUES(p_owner,d.id,aid,r,slot_name,p_payload->>'language',chosen_provider,b,p_payload->>'sha256',
     left(p_payload->>'content_type',100),p_payload->>'file_name',sec,p_payload->>'idempotency_key',p_payload->>'request_hash') RETURNING * INTO s;
   IF chosen_provider='r2' AND sec>0 THEN
     UPDATE gma_upload_sessions SET object_key='ingest/'||p_owner||'/'||id||'/'||gen_random_uuid() WHERE id=s.id RETURNING * INTO s;
   END IF;
   INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,language,position)
     VALUES(d.id,p_owner,aid,r,slot_name,s.language,(SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id));
   FOREACH k IN ARRAY keys LOOP
     UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes+b,reserved_seconds=reserved_seconds+reserved_sec WHERE account_key=k;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'reserve',b,reserved_sec);
   END LOOP;
   PERFORM gma_upload_enqueue_job('provision',s.id,'{}','provision:'||s.id,now());
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
   RETURN to_jsonb(s);
 ELSIF p_action='intent' THEN
   IF s.state<>'provisioning' OR s.provider_data->>'provision_started'='true' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET provider_data=provider_data||jsonb_build_object('provision_started',true),updated_at=now()
     WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='receipt' THEN
   IF COALESCE((p_payload->>'received_bytes')::bigint,-1)<>s.expected_input_bytes THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE gma_upload_sessions SET provider_data=provider_data||jsonb_build_object('received_bytes',s.expected_input_bytes),updated_at=now()
     WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='bind' THEN
   -- Save even a late provisioning response, so cancellation can clean it up.
   IF s.provider_ref IS NOT NULL AND s.provider_ref<>p_payload->>'provider_ref' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET provider_ref=p_payload->>'provider_ref',provider_data=provider_data||COALESCE(p_payload->'provider_data','{}'),
     state=CASE WHEN state='provisioning' THEN 'uploading' ELSE state END,revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   IF s.provider='r2' AND s.max_duration_seconds>0 THEN
     IF s.multipart_upload_id IS NOT NULL AND s.multipart_upload_id IS DISTINCT FROM s.provider_data->>'multipartUploadId' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
     IF s.provider_ref IS DISTINCT FROM s.object_key OR length(COALESCE(s.provider_data->>'multipartUploadId',''))<1 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
     UPDATE gma_upload_sessions SET multipart_upload_id=provider_data->>'multipartUploadId' WHERE id=s.id RETURNING * INTO s;
   END IF;
   UPDATE gma_media_assets SET provider_ref=s.provider_ref WHERE id=s.asset_id;
   IF s.state='cancelling' THEN PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now()); END IF;
   RETURN to_jsonb(s);
 ELSIF p_action='pause' THEN
   IF s.state NOT IN ('uploading','paused') THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET state=CASE WHEN p_payload->>'paused'='true' THEN 'paused' ELSE 'uploading' END,
     revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='cancel' THEN
   IF EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) OR EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner AND avatar_url=a.delivery_path) THEN RAISE EXCEPTION 'UPLOAD_ASSET_IN_USE'; END IF;
   IF s.quota_released OR s.state='cancelling' THEN RETURN to_jsonb(s); END IF;
   DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   UPDATE gma_processing_attempts SET state='cancelled',finished_at=now() WHERE session_id=s.id AND state='running';
   UPDATE gma_media_assets SET state='deleting',updated_at=now() WHERE id=s.asset_id;
   UPDATE gma_upload_sessions SET state='cancelling',revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
   PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now()); RETURN to_jsonb(s);
 ELSIF p_action='observe' THEN
   IF s.state IN ('cancelling','cancelled','expired') OR a.state IN ('deleting','deleted') THEN RETURN to_jsonb(a); END IF;
   IF p_payload->>'state' NOT IN ('processing','ready','rejected') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF s.provider='r2' AND s.max_duration_seconds>0 AND p_payload->>'state'='ready' THEN
     IF a.state<>'processing' OR (p_payload->'metadata'->>'source_sha256') IS DISTINCT FROM s.source_sha256
       OR COALESCE(p_payload->'metadata'->>'outputs_verified','')<>'true'
       OR COALESCE((p_payload->>'duration_seconds')::double precision,0)<=0
       OR (p_payload->>'duration_seconds')::double precision>s.max_duration_seconds
       OR COALESCE((p_payload->'metadata'->>'processed_bytes')::bigint,0)<=0
       OR NOT EXISTS(SELECT 1 FROM gma_upload_jobs WHERE id=(p_payload->>'job_id')::uuid AND session_id=s.id
          AND kind='process' AND state='running' AND lease_owner=p_payload->>'worker' AND lease_until>now())
       THEN RAISE EXCEPTION 'UPLOAD_PROCESSING_UNVERIFIED'; END IF;
   END IF;
   IF p_payload->>'state'='ready' THEN
     IF COALESCE((p_payload->>'received_bytes')::bigint,-1)<>s.expected_input_bytes OR
       (s.provider='stream' AND (COALESCE((p_payload->>'duration_seconds')::double precision,0)<=0
          OR (p_payload->>'duration_seconds')::double precision>s.max_duration_seconds
          OR COALESCE(p_payload->>'pct_complete','')<>'100' OR COALESCE(p_payload->>'ready_to_stream','')<>'true'))
       THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
     actual_sec=CASE WHEN s.provider='stream' THEN ceil((p_payload->>'duration_seconds')::double precision)::bigint ELSE 0 END;
     IF NOT s.quota_confirmed THEN
       FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
         UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,used_bytes=used_bytes+s.expected_input_bytes,
           reserved_seconds=reserved_seconds-CASE WHEN s.provider='stream' THEN s.max_duration_seconds ELSE 0 END,used_seconds=used_seconds+actual_sec WHERE account_key=k;
         INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'confirm',s.expected_input_bytes,actual_sec);
       END LOOP;
       UPDATE gma_upload_sessions SET quota_confirmed=true WHERE id=s.id;
     END IF;
   END IF;
   UPDATE gma_media_assets SET original_bytes=CASE WHEN s.provider='r2' AND s.max_duration_seconds>0 THEN (p_payload->>'received_bytes')::bigint ELSE original_bytes END,
     processed_bytes=COALESCE((p_payload->'metadata'->>'processed_bytes')::bigint,processed_bytes),
     auxiliary_bytes=CASE WHEN s.max_duration_seconds=0 THEN (p_payload->'metadata'->>'normalized_bytes')::bigint ELSE auxiliary_bytes END,
     state=p_payload->>'state',received_bytes=(p_payload->>'received_bytes')::bigint,
     provider_reported_size=(p_payload->>'provider_reported_size')::bigint,duration_seconds=(p_payload->>'duration_seconds')::double precision,
     metadata=COALESCE(p_payload->'metadata',metadata),delivery_path=COALESCE(p_payload->>'delivery_path',delivery_path),updated_at=now()
     WHERE id=s.asset_id RETURNING * INTO a;
   UPDATE gma_upload_sessions SET state=CASE WHEN (p_payload->>'received_bytes')::bigint=expected_input_bytes THEN 'uploaded' ELSE state END,revision=revision+1,updated_at=now() WHERE id=s.id;
   IF a.state='rejected' THEN
     PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now());
     UPDATE gma_upload_sessions SET state='cancelling' WHERE id=s.id;
     DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   END IF;
   RETURN to_jsonb(a);
 ELSIF p_action='delete_confirmed' THEN
   IF s.quota_released THEN RETURN to_jsonb(s); END IF;
   IF COALESCE(p_payload->>'absent','')<>'true' OR EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) OR EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner AND avatar_url=a.delivery_path)
     OR (now()<s.expires_at AND (s.provider='r2' OR s.provider_ref IS NOT NULL OR s.provider_data->>'provision_started'='true')) THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   -- A cancelled worker can have a bounded R2 write in flight. Confirm cleanup again after it settles.
   IF s.provider='r2' AND s.max_duration_seconds>0 AND EXISTS(SELECT 1 FROM gma_upload_jobs WHERE session_id=s.id AND kind='process'
      AND ((state='running' AND lease_until>now()) OR updated_at>now()-interval '3 minutes'))
     THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
     IF s.quota_confirmed THEN
       SELECT seconds INTO actual_sec FROM gma_upload_ledger WHERE session_id=s.id AND account_key=k AND event='confirm';
       UPDATE gma_upload_quota SET used_bytes=used_bytes-s.expected_input_bytes,used_seconds=used_seconds-actual_sec WHERE account_key=k;
     ELSE
       UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,reserved_seconds=reserved_seconds-CASE WHEN s.provider='stream' THEN s.max_duration_seconds ELSE 0 END WHERE account_key=k;
     END IF;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'release',s.expected_input_bytes,COALESCE(actual_sec,s.max_duration_seconds));
   END LOOP;
   UPDATE gma_media_assets SET state='deleted',updated_at=now() WHERE id=s.asset_id;
   DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   UPDATE gma_upload_sessions SET state='cancelled',quota_released=true,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   RETURN to_jsonb(s);
 ELSIF p_action='abandon' THEN
   IF d.state<>'draft' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   FOR s IN SELECT * FROM gma_upload_sessions WHERE draft_id=d.id AND NOT quota_released LOOP
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END LOOP;
   UPDATE gma_upload_drafts SET state='abandoned',revision=revision+1 WHERE id=d.id RETURNING * INTO d; RETURN to_jsonb(d);
 ELSIF p_action='avatar' THEN
   IF d.purpose<>'avatar' THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   SELECT a1.* INTO a FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.draft_id=d.id AND m.role='avatar';
   IF NOT FOUND OR a.state<>'ready' THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   -- Onboarding may precede creator_profiles; the owner may use delivery_path after ready.
   SELECT us.* INTO s FROM gma_upload_sessions us JOIN gma_media_assets ma ON ma.id=us.asset_id
     JOIN creator_profiles cp ON cp.avatar_url=ma.delivery_path AND cp.user_id=p_owner WHERE us.owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=a.delivery_path WHERE user_id=p_owner;
   UPDATE gma_upload_drafts SET state='published',revision=revision+1 WHERE id=d.id;
   IF s.id IS NOT NULL AND s.asset_id<>a.id THEN
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END IF;
   RETURN to_jsonb(a);
 ELSIF p_action='label_subtitle' THEN
   IF s.role<>'subtitles' OR COALESCE(p_payload->>'language','') !~ '^[a-zA-Z0-9-]{2,35}$' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   slot_name='subtitles:'||(p_payload->>'language');
   IF EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND slot=slot_name AND asset_id<>s.asset_id) THEN RAISE EXCEPTION 'UPLOAD_SLOT_OCCUPIED'; END IF;
   UPDATE gma_draft_media SET language=p_payload->>'language',slot=slot_name WHERE draft_id=d.id AND asset_id=s.asset_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE gma_upload_sessions SET language=p_payload->>'language',slot=slot_name WHERE id=s.id;
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;RETURN to_jsonb(d);
 ELSIF p_action='reorder' THEN
   UPDATE gma_draft_media SET position=(p_payload->>'position')::integer WHERE draft_id=d.id AND asset_id=(p_payload->>'asset_id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=d.id RETURNING * INTO d; RETURN to_jsonb(d);
 ELSIF p_action='publish' THEN
   IF d.purpose<>'title' OR NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   SELECT a1.* INTO a FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.draft_id=d.id AND m.role='main';
   IF NOT FOUND OR a.state<>'ready' OR EXISTS(SELECT 1 FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id
     WHERE m.draft_id=d.id AND (a1.state<>'ready' OR a1.owner_id<>p_owner)) THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   IF length(COALESCE(trim(d.metadata->>'title'),'')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF d.title_id IS NULL THEN
     INSERT INTO peliculas(slug,title,synopsis,year,duration,author,creator_user_id,genre,language,file_size_bytes,status,source_page,stream_uid,playback_kind)
     VALUES('gma-'||d.id,trim(d.metadata->>'title'),d.metadata->>'synopsis',d.metadata->>'year',
       CASE WHEN a.duration_seconds>=3600 THEN floor(a.duration_seconds/3600)::int::text||'h '||lpad((floor(a.duration_seconds/60)::int%60)::text,2,'0')||'m' WHEN a.duration_seconds<60 THEN floor(a.duration_seconds)::int::text||'s' ELSE floor(a.duration_seconds/60)::int::text||'m '||lpad((floor(a.duration_seconds)::int%60)::text,2,'0')||'s' END, (SELECT creator_name FROM creator_profiles WHERE user_id=p_owner),p_owner,
       CASE WHEN a.duration_seconds>2400 THEN 'Película' ELSE 'Cortometraje' END,d.metadata->>'language',
       a.expected_input_bytes,'published','studio_upload',CASE WHEN a.provider='stream' THEN a.provider_ref END,CASE WHEN a.provider='stream' THEN 'stream' ELSE 'r2_hls' END) RETURNING * INTO film;
   ELSE
     SELECT * INTO film FROM peliculas WHERE id=d.title_id AND creator_user_id=p_owner FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
     IF film.media_revision<>COALESCE((d.metadata->>'base_title_revision')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
     DELETE FROM gma_title_media WHERE title_id=film.id;
     UPDATE peliculas SET title=trim(d.metadata->>'title'),synopsis=d.metadata->>'synopsis',year=d.metadata->>'year',
       language=d.metadata->>'language',duration=CASE WHEN a.duration_seconds>=3600 THEN floor(a.duration_seconds/3600)::int::text||'h '||lpad((floor(a.duration_seconds/60)::int%60)::text,2,'0')||'m' WHEN a.duration_seconds<60 THEN floor(a.duration_seconds)::int::text||'s' ELSE floor(a.duration_seconds/60)::int::text||'m '||lpad((floor(a.duration_seconds)::int%60)::text,2,'0')||'s' END,stream_uid=CASE WHEN a.provider='stream' THEN a.provider_ref END,playback_kind=CASE WHEN a.provider='stream' THEN 'stream' ELSE 'r2_hls' END,
       genre=CASE WHEN a.duration_seconds>2400 THEN 'Película' ELSE 'Cortometraje' END,file_size_bytes=a.expected_input_bytes,status='published',media_revision=media_revision+1
       WHERE id=film.id RETURNING * INTO film;
   END IF;
   IF d.metadata->>'genre' IS NOT NULL THEN
     DELETE FROM peliculas_colecciones WHERE pelicula_id=film.id AND coleccion_id IN (SELECT id FROM colecciones WHERE slug IN
       ('drama','thriller','documental','experimental','comedia','terror','ciencia-ficcion','romance','animacion'));
     INSERT INTO peliculas_colecciones(pelicula_id,coleccion_id) SELECT film.id,id FROM colecciones WHERE slug=(CASE d.metadata->>'genre' WHEN 'Drama' THEN 'drama' WHEN 'Thriller' THEN 'thriller' WHEN 'Documental' THEN 'documental' WHEN 'Experimental' THEN 'experimental' WHEN 'Comedia' THEN 'comedia' WHEN 'Terror' THEN 'terror' WHEN 'Ciencia ficción' THEN 'ciencia-ficcion' WHEN 'Romance' THEN 'romance' WHEN 'Animación' THEN 'animacion' END);
   END IF;
   INSERT INTO gma_title_media SELECT film.id,asset_id,owner_id,role,slot,language,position FROM gma_draft_media WHERE draft_id=d.id;
   UPDATE peliculas SET r2_poster_url=COALESCE((SELECT a1.delivery_path FROM gma_title_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id
       WHERE m.title_id=film.id AND m.role IN ('poster_h','poster_v','poster') ORDER BY CASE m.role WHEN 'poster_h' THEN 0 WHEN 'poster_v' THEN 1 ELSE 2 END LIMIT 1),CASE WHEN a.provider='r2' AND a.metadata->>'poster_key' IS NOT NULL THEN '/api/media/'||a.id||'/hls/poster.jpg' END),
     r2_subtitle_url=(SELECT a1.delivery_path FROM gma_title_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.title_id=film.id AND m.role='subtitles' ORDER BY m.position LIMIT 1)
     WHERE id=film.id RETURNING * INTO film;
   INSERT INTO gma_upload_publications(draft_id,request_hash,title_id) VALUES(d.id,p_payload->>'request_hash',film.id);
   UPDATE gma_upload_drafts SET state='published',title_id=film.id,revision=revision+1 WHERE id=d.id;
   -- Previous assets are retired only after the new publication is committed atomically.
   FOR s IN SELECT us.* FROM gma_upload_sessions us JOIN gma_upload_drafts dr ON dr.id=us.draft_id
     WHERE dr.title_id=film.id AND dr.id<>d.id AND NOT us.quota_released LOOP
     IF NOT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) THEN
       PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
     END IF;
   END LOOP;
   RETURN to_jsonb(film);
 END IF;
 RAISE EXCEPTION 'UPLOAD_INVALID_INPUT';
END; $function$;
