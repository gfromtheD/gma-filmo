-- UUID-based publication and retained title snapshots. This migration is additive.
BEGIN;
DO $$ DECLARE missing text; BEGIN
 SELECT string_agg(x.table_name||'.'||x.column_name, ', ') INTO missing
 FROM (VALUES ('gma_upload_drafts','title_id'),('gma_draft_media','asset_id'),('gma_media_assets','provider'),
   ('gma_media_assets','state'),('gma_title_media','asset_id'),('peliculas','media_revision'),('peliculas','creator_user_id')) x(table_name,column_name)
 WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=x.table_name AND c.column_name=x.column_name);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MEDIA_PUBLISH_PREFLIGHT: missing %',missing; END IF;
END $$;

ALTER TABLE public.gma_upload_publications ADD COLUMN IF NOT EXISTS main_media_id uuid;

CREATE TABLE IF NOT EXISTS public.gma_title_media_versions (
 title_id bigint NOT NULL REFERENCES public.peliculas(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>=0),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 retained_until timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(title_id,revision)
);
ALTER TABLE public.gma_title_media_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gma_title_media_versions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.gma_title_media_versions TO service_role;
CREATE INDEX IF NOT EXISTS gma_title_media_versions_retained ON public.gma_title_media_versions(retained_until);

CREATE OR REPLACE FUNCTION public.gma_media_has_references(p_asset_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=p_asset_id)
 OR EXISTS(SELECT 1 FROM gma_title_media_versions v CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.snapshot->'media','[]'::jsonb)) m
           WHERE v.retained_until>now() AND m->>'asset_id'=p_asset_id::text)
 OR EXISTS(SELECT 1 FROM creator_profiles cp JOIN gma_media_assets a ON a.owner_id=cp.user_id AND a.delivery_path=cp.avatar_url WHERE a.id=p_asset_id);
$$;

CREATE OR REPLACE FUNCTION public.gma_upload_command(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d gma_upload_drafts; a gma_media_assets; film peliculas; result jsonb; existing gma_upload_publications;
 main_id uuid; current_revision integer; snapshot jsonb; old_media jsonb;
BEGIN
 IF p_action='publish' THEN
   INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
   PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
   SELECT * INTO d FROM gma_upload_drafts WHERE id=(p_payload->>'draft_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   SELECT * INTO existing FROM gma_upload_publications WHERE draft_id=d.id;
   IF FOUND THEN
     IF existing.request_hash IS DISTINCT FROM p_payload->>'request_hash' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     main_id=COALESCE(existing.main_media_id,(SELECT asset_id FROM gma_title_media WHERE title_id=existing.title_id AND role='main' AND slot='main'));
     IF main_id IS DISTINCT FROM NULLIF(p_payload->>'main_media_id','')::uuid THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     SELECT * INTO film FROM peliculas WHERE id=existing.title_id;
     RETURN to_jsonb(film);
   END IF;
   IF p_payload->>'main_media_id' IS NULL OR p_payload->>'main_media_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   main_id=(p_payload->>'main_media_id')::uuid;
   IF d.state<>'draft' OR d.purpose<>'title' OR NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner)
      THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   IF NOT EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND role='main' AND slot='main' AND asset_id=main_id AND owner_id=p_owner)
     THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   SELECT ma.* INTO a FROM gma_media_assets ma WHERE ma.id=main_id AND ma.owner_id=p_owner FOR UPDATE;
   IF NOT FOUND OR a.state<>'ready' THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   IF EXISTS(SELECT 1 FROM gma_draft_media m JOIN gma_media_assets ma ON ma.id=m.asset_id
       WHERE m.draft_id=d.id AND (ma.owner_id<>p_owner OR ma.state<>'ready')) THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   IF length(COALESCE(trim(d.metadata->>'title'),'')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF d.title_id IS NOT NULL THEN
     SELECT * INTO film FROM peliculas WHERE id=d.title_id AND creator_user_id=p_owner FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
     IF film.media_delete_state<>'none' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
     IF film.media_revision<>COALESCE((d.metadata->>'base_title_revision')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
     current_revision=film.media_revision;
     SELECT COALESCE(jsonb_agg(jsonb_build_object('asset_id',tm.asset_id,'owner_id',tm.owner_id,'role',tm.role,'slot',tm.slot,'language',tm.language,'position',tm.position)
          ORDER BY tm.role,tm.slot),'[]'::jsonb) INTO old_media FROM gma_title_media tm WHERE tm.title_id=film.id;
     snapshot=jsonb_build_object('media',old_media,'playback_kind',film.playback_kind,'title',film.title,'synopsis',film.synopsis,'year',film.year,
       'duration',film.duration,'genre',film.genre,'language',film.language,'file_size_bytes',film.file_size_bytes,
       'r2_video_url',film.r2_video_url,'r2_poster_url',film.r2_poster_url,'r2_subtitle_url',film.r2_subtitle_url,'stream_uid',film.stream_uid);
     INSERT INTO gma_title_media_versions(title_id,revision,owner_id,snapshot,retained_until)
       VALUES(film.id,current_revision,p_owner,snapshot,now()+interval '7 days') ON CONFLICT(title_id,revision) DO NOTHING;
   END IF;
   result=gma_upload_command_v2_compat(p_owner,p_action,p_payload);
   UPDATE gma_upload_publications SET main_media_id=main_id WHERE draft_id=d.id;
   IF a.provider IN ('mock','peertube') THEN
     UPDATE peliculas SET playback_kind='media',stream_uid=NULL,r2_video_url=NULL WHERE id=(result->>'id')::bigint;
     result=(SELECT to_jsonb(p) FROM peliculas p WHERE p.id=(result->>'id')::bigint);
   END IF;
   RETURN result;
 END IF;
 IF p_action='reserve' THEN RETURN gma_media_reserve(p_owner,p_payload); END IF;
 IF p_action IN ('observe','cancel','bind','intent','receipt','delete_confirmed') THEN
   PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
   SELECT * INTO d FROM gma_upload_drafts WHERE id=(SELECT draft_id FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner);
   SELECT * INTO a FROM gma_media_assets WHERE id=(SELECT asset_id FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner) FOR UPDATE;
   IF a.id IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF p_action='cancel' AND EXISTS(SELECT 1 FROM gma_title_media_versions v CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.snapshot->'media','[]'::jsonb)) m
       WHERE v.retained_until>now() AND m->>'asset_id'=a.id::text) THEN RETURN to_jsonb(a); END IF;
   IF p_action='cancel' AND gma_media_has_references(a.id) THEN RAISE EXCEPTION 'UPLOAD_ASSET_IN_USE'; END IF;
   IF p_action<>'cancel' AND a.provider IN ('mock','peertube') THEN RAISE EXCEPTION 'UPLOAD_PROTOCOL_UNSUPPORTED'; END IF;
   IF p_action='observe' AND a.state IN ('ready','rejected','deleting','deleted') THEN RETURN to_jsonb(a); END IF;
 END IF;
 RETURN gma_upload_command_v2_compat(p_owner,p_action,p_payload);
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('gma_upload_command','gma_media_has_references') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
