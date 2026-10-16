-- Reversible title retirement, republish and durable deletion. Follows media publication 080003.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.gma_title_media_versions') IS NULL OR to_regclass('public.gma_media_command_results') IS NULL
 THEN RAISE EXCEPTION 'MEDIA_TITLE_PREFLIGHT: apply media 080003 and 080002 first'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gma_title_command(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE film peliculas; existing gma_media_command_results; result jsonb; key uuid; body_hash text; title_id bigint; s gma_upload_sessions; a gma_media_assets;
BEGIN
 IF p_action NOT IN ('unpublish','republish','delete','import_verified_legacy') OR p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 BEGIN key=(p_payload->>'idempotency_key')::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END;
 body_hash=p_payload->>'request_hash';
 IF body_hash IS NULL OR body_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 title_id=(p_payload->>'title_id')::bigint;
 SELECT * INTO existing FROM gma_media_command_results WHERE owner_id=p_owner AND action=p_action AND idempotency_key=key;
 IF FOUND THEN
   IF existing.title_id IS DISTINCT FROM title_id OR existing.request_hash IS DISTINCT FROM body_hash THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN existing.result;
 END IF;
 SELECT * INTO film FROM peliculas WHERE id=title_id AND creator_user_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF film.media_delete_state<>'none' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF film.media_revision IS DISTINCT FROM (p_payload->>'expected_revision')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='unpublish' THEN
   IF film.status='published' THEN
     UPDATE peliculas SET status='unpublished',media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   ELSIF film.status IS DISTINCT FROM 'unpublished' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   result=to_jsonb(film);
 ELSIF p_action='republish' THEN
   IF film.status IS DISTINCT FROM 'unpublished' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   IF NOT EXISTS(SELECT 1 FROM gma_title_media m JOIN gma_media_assets assetrow ON assetrow.id=m.asset_id
       WHERE m.title_id=film.id AND m.role='main' AND m.slot='main' AND m.owner_id=p_owner AND assetrow.owner_id=p_owner AND assetrow.state='ready')
      OR EXISTS(SELECT 1 FROM gma_title_media m JOIN gma_media_assets assetrow ON assetrow.id=m.asset_id
       WHERE m.title_id=film.id AND (m.owner_id<>p_owner OR assetrow.owner_id<>p_owner OR assetrow.state<>'ready')) THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   UPDATE peliculas SET status='published',media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   result=to_jsonb(film);
 ELSIF p_action='delete' THEN
   IF film.status NOT IN ('published','unpublished') THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE peliculas SET status='unpublished',media_delete_state='pending',media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   UPDATE gma_title_media_versions v SET retained_until=now() WHERE v.title_id=film.id;
   UPDATE gma_upload_drafts ud SET state='abandoned',revision=revision+1,updated_at=now() WHERE ud.title_id=film.id AND ud.state='draft';
   DELETE FROM gma_title_media tm WHERE tm.title_id=film.id;
   FOR s IN SELECT us.* FROM gma_upload_sessions us JOIN gma_upload_drafts d ON d.id=us.draft_id
       WHERE d.title_id=film.id AND NOT us.quota_released ORDER BY us.id LOOP
     SELECT * INTO a FROM gma_media_assets ma WHERE ma.id=s.asset_id;
     IF a.id IS NOT NULL AND NOT gma_media_has_references(a.id) THEN
       PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
     END IF;
   END LOOP;
   result=jsonb_build_object('title_id',film.id,'status',film.status,'media_delete_state',film.media_delete_state,'accepted',true);
 ELSE
   -- Reserved for a trusted inventory/backfill runner; all identity and readiness checks remain server-side.
   IF film.status IS DISTINCT FROM 'published' OR EXISTS(SELECT 1 FROM gma_title_media tm WHERE tm.title_id=film.id AND tm.role='main' AND tm.slot='main') THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   SELECT * INTO a FROM gma_media_assets WHERE id=(p_payload->>'asset_id')::uuid AND owner_id=p_owner AND state='ready' AND role='main' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   INSERT INTO gma_title_media(title_id,asset_id,owner_id,role,slot) VALUES(film.id,a.id,p_owner,'main','main');
   UPDATE peliculas SET playback_kind=CASE WHEN a.provider IN ('mock','peertube') THEN 'media' ELSE playback_kind END,media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   result=to_jsonb(film);
 END IF;
 INSERT INTO gma_media_command_results(owner_id,title_id,action,idempotency_key,request_hash,result)
   VALUES(p_owner,title_id,p_action,key,body_hash,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.gma_title_restore_version(p_owner uuid,p_title_id bigint,p_expected_revision integer,p_restore_revision integer,p_idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE film peliculas; target gma_title_media_versions; old_media jsonb; current_snapshot jsonb; restored jsonb; result jsonb; body_hash text;
BEGIN
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 body_hash=repeat(md5(p_title_id::text||':'||p_restore_revision::text||':'||p_expected_revision::text),2);
 SELECT cr.result INTO result FROM gma_media_command_results cr WHERE cr.owner_id=p_owner AND cr.action='restore_version' AND cr.idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF (result->>'title_id')::bigint IS DISTINCT FROM p_title_id OR result->>'request_hash' IS DISTINCT FROM body_hash THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN result->'value';
 END IF;
 SELECT * INTO film FROM peliculas WHERE id=p_title_id AND creator_user_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF film.media_delete_state<>'none' OR film.media_revision<>p_expected_revision THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 SELECT * INTO target FROM gma_title_media_versions WHERE title_id=p_title_id AND revision=p_restore_revision AND owner_id=p_owner AND retained_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(target.snapshot->'media','[]'::jsonb)) m
      LEFT JOIN gma_media_assets assetrow ON assetrow.id=(m->>'asset_id')::uuid
      WHERE assetrow.id IS NULL OR assetrow.owner_id<>p_owner OR assetrow.state<>'ready' OR (m->>'owner_id')::uuid<>p_owner) THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('asset_id',tm.asset_id,'owner_id',tm.owner_id,'role',tm.role,'slot',tm.slot,'language',tm.language,'position',tm.position)
      ORDER BY tm.role,tm.slot),'[]'::jsonb) INTO old_media FROM gma_title_media tm WHERE tm.title_id=film.id;
 current_snapshot=jsonb_build_object('media',old_media,'playback_kind',film.playback_kind,'title',film.title,'synopsis',film.synopsis,'year',film.year,
   'duration',film.duration,'genre',film.genre,'language',film.language,'file_size_bytes',film.file_size_bytes,
   'r2_video_url',film.r2_video_url,'r2_poster_url',film.r2_poster_url,'r2_subtitle_url',film.r2_subtitle_url,'stream_uid',film.stream_uid);
 INSERT INTO gma_title_media_versions(title_id,revision,owner_id,snapshot,retained_until)
   VALUES(film.id,film.media_revision,p_owner,current_snapshot,now()+interval '7 days') ON CONFLICT(title_id,revision) DO NOTHING;
 DELETE FROM gma_title_media tm WHERE tm.title_id=film.id;
 INSERT INTO gma_title_media(title_id,asset_id,owner_id,role,slot,language,position)
   SELECT film.id,(m->>'asset_id')::uuid,p_owner,m->>'role',m->>'slot',m->>'language',COALESCE((m->>'position')::integer,0)
   FROM jsonb_array_elements(COALESCE(target.snapshot->'media','[]'::jsonb)) m;
 UPDATE gma_title_media_versions SET retained_until=now()+interval '7 days' WHERE title_id=p_title_id AND revision=p_restore_revision;
 UPDATE peliculas SET title=target.snapshot->>'title',synopsis=target.snapshot->>'synopsis',year=target.snapshot->>'year',duration=target.snapshot->>'duration',
   genre=target.snapshot->>'genre',language=target.snapshot->>'language',file_size_bytes=(target.snapshot->>'file_size_bytes')::bigint,
   r2_video_url=target.snapshot->>'r2_video_url',r2_poster_url=target.snapshot->>'r2_poster_url',r2_subtitle_url=target.snapshot->>'r2_subtitle_url',
   stream_uid=target.snapshot->>'stream_uid',playback_kind=target.snapshot->>'playback_kind',status='published',media_revision=media_revision+1
   WHERE id=film.id RETURNING * INTO film;
 IF EXISTS(SELECT 1 FROM gma_title_media tm WHERE tm.title_id=film.id AND tm.role='main' AND tm.slot='main') AND
    EXISTS(SELECT 1 FROM gma_title_media tm JOIN gma_media_assets assetrow ON assetrow.id=tm.asset_id WHERE tm.title_id=film.id AND tm.role='main' AND assetrow.provider IN ('mock','peertube')) THEN
   UPDATE peliculas SET playback_kind='media',r2_video_url=NULL,stream_uid=NULL WHERE id=film.id RETURNING * INTO film;
 END IF;
 DELETE FROM peliculas_colecciones WHERE pelicula_id=film.id AND coleccion_id IN (SELECT id FROM colecciones WHERE slug IN
   ('drama','thriller','documental','experimental','comedia','terror','ciencia-ficcion','romance','animacion'));
 INSERT INTO peliculas_colecciones(pelicula_id,coleccion_id) SELECT film.id,id FROM colecciones WHERE slug=CASE target.snapshot->>'genre'
   WHEN 'Drama' THEN 'drama' WHEN 'Terror' THEN 'terror' END;
 result=to_jsonb(film);
 INSERT INTO gma_media_command_results(owner_id,title_id,action,idempotency_key,request_hash,result)
   VALUES(p_owner,p_title_id,'restore_version',p_idempotency_key,body_hash,jsonb_build_object('title_id',p_title_id,'request_hash',body_hash,'value',result));
 RETURN result;
END $$;

-- Keep legacy retirement/edit entry points behind the new title ownership and deletion state.
DO $$ BEGIN
 IF to_regprocedure('public.gma_upload_command_v3_compat(uuid,text,jsonb)') IS NULL THEN ALTER FUNCTION public.gma_upload_command(uuid,text,jsonb) RENAME TO gma_upload_command_v3_compat; END IF;
 IF to_regprocedure('public.gma_upload_schedule_v2_compat()') IS NULL THEN ALTER FUNCTION public.gma_upload_schedule() RENAME TO gma_upload_schedule_v2_compat; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.gma_upload_command(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE film peliculas; hash text; key uuid; result jsonb;
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
 ELSIF p_action='delete_account' THEN
   UPDATE peliculas SET status='unpublished',media_delete_state='pending',media_revision=media_revision+CASE WHEN status='published' THEN 1 ELSE 0 END WHERE creator_user_id=p_owner AND media_delete_state='none';
   UPDATE gma_title_media_versions SET retained_until=now() WHERE owner_id=p_owner;
   DELETE FROM gma_title_media WHERE owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=NULL WHERE user_id=p_owner;
   RETURN gma_upload_command_v3_compat(p_owner,p_action,p_payload);
 ELSIF p_action='purge_account' THEN
   DELETE FROM gma_media_command_results WHERE owner_id=p_owner;
   DELETE FROM gma_title_media_versions WHERE owner_id=p_owner;
 END IF;
 RETURN gma_upload_command_v3_compat(p_owner,p_action,p_payload);
END $$;
CREATE OR REPLACE FUNCTION public.gma_upload_schedule() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 n=gma_upload_schedule_v2_compat();
 UPDATE peliculas p SET media_delete_state='done'
 WHERE p.media_delete_state='pending' AND NOT EXISTS(SELECT 1 FROM gma_upload_drafts d JOIN gma_upload_sessions s ON s.draft_id=d.id
   WHERE d.title_id=p.id AND NOT s.quota_released);
 RETURN n;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('gma_title_command','gma_title_restore_version','gma_upload_command','gma_upload_command_v3_compat','gma_upload_schedule','gma_upload_schedule_v2_compat') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
