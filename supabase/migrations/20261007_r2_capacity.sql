-- Capacity changes keep the existing quota/publication/cancellation transactions intact.
BEGIN;
CREATE INDEX IF NOT EXISTS gma_title_media_asset ON gma_title_media(asset_id,title_id);
CREATE INDEX IF NOT EXISTS gma_draft_media_asset ON gma_draft_media(asset_id);
CREATE INDEX IF NOT EXISTS gma_sessions_draft_created ON gma_upload_sessions(draft_id,created_at);
CREATE INDEX IF NOT EXISTS gma_sessions_owner_state ON gma_upload_sessions(owner_id,state);
CREATE INDEX IF NOT EXISTS gma_drafts_owner_state_updated ON gma_upload_drafts(owner_id,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS gma_jobs_session_kind_state ON gma_upload_jobs(session_id,kind,state);
CREATE INDEX IF NOT EXISTS gma_processing_session ON gma_processing_attempts(session_id);

-- Preserve the audited implementation for all mutations that can reach quota writers.
DO $$ BEGIN
 IF to_regprocedure('public.gma_video_command_locked(uuid,text,jsonb)') IS NULL THEN
   ALTER FUNCTION public.gma_video_command(uuid,text,jsonb) RENAME TO gma_video_command_locked;
 END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.gma_video_command(p_owner uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; a gma_media_assets; changed uuid;
BEGIN
 IF p_action NOT IN ('authorize','heartbeat') THEN
   RETURN gma_video_command_locked(p_owner,p_action,p_payload);
 END IF;
 -- A read-only authorization must not serialize unrelated owners through global quota.
 SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF s.provider<>'r2' OR s.max_duration_seconds<=0 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id;
 IF s.state IN ('cancelling','cancelled','expired') OR a.state IN ('deleting','deleted') THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF p_action='authorize' THEN
   IF s.state NOT IN ('uploading','paused') OR now()>=s.expires_at THEN RAISE EXCEPTION 'UPLOAD_EXPIRED'; END IF;
   IF s.transfer_generation<>COALESCE((p_payload->>'generation')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   RETURN to_jsonb(s);
 END IF;
 -- Lock only the job being renewed. Do not acquire job -> session/draft row locks;
 -- quota/cancellation/scheduler transactions retain their existing global lock order.
 UPDATE gma_upload_jobs j SET lease_until=now()+interval '120 seconds',updated_at=now()
 FROM gma_upload_sessions us JOIN gma_media_assets ma ON ma.id=us.asset_id
 WHERE j.id=(p_payload->>'job_id')::uuid AND j.kind='process' AND j.session_id=us.id
 AND us.id=s.id AND us.owner_id=p_owner AND us.provider='r2' AND us.max_duration_seconds>0
 AND us.state NOT IN ('cancelling','cancelled','expired') AND ma.state NOT IN ('deleting','deleted')
 AND j.state='running' AND j.lease_owner=p_payload->>'worker' AND j.lease_until>now()
 RETURNING j.id INTO changed;
 IF changed IS NULL THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 RETURN jsonb_build_object('ok',true);
END; $$;

-- Lookup of an individual verified derivative must not scan a film-sized JSON array.
-- The original output inventory remains available for audits and playlist validation.
CREATE TABLE IF NOT EXISTS gma_media_outputs (
 asset_id uuid NOT NULL REFERENCES gma_media_assets(id) ON DELETE CASCADE,
 relative text NOT NULL CHECK(length(relative) BETWEEN 1 AND 512 AND relative ~ '^[a-zA-Z0-9_./-]+$'
   AND relative !~ '(^/|(^|/)\.\.?(/|$)|//)'),
 object_key text NOT NULL,
 PRIMARY KEY(asset_id,relative)
);
ALTER TABLE gma_media_outputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gma_media_outputs FROM PUBLIC,anon,authenticated;
GRANT ALL ON gma_media_outputs TO service_role;
CREATE OR REPLACE FUNCTION gma_media_outputs_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prefix text;
BEGIN
 DELETE FROM gma_media_outputs WHERE asset_id=NEW.id;
 IF NEW.provider='r2' AND NEW.state='ready' AND jsonb_typeof(NEW.metadata->'outputs')='array' THEN
   prefix=NEW.metadata->>'hls_prefix';
   IF prefix IS NULL OR prefix NOT LIKE 'media/'||NEW.id||'/hls/%' OR prefix ~ '(^|/)\.\.?(/|$)'
     THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   INSERT INTO gma_media_outputs(asset_id,relative,object_key)
   SELECT NEW.id,o->>'relative',prefix||(o->>'relative') FROM jsonb_array_elements(NEW.metadata->'outputs') o;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS gma_media_outputs_sync ON gma_media_assets;
CREATE TRIGGER gma_media_outputs_sync AFTER INSERT OR UPDATE OF state,metadata ON gma_media_assets
FOR EACH ROW EXECUTE FUNCTION gma_media_outputs_sync();
-- Backfill only derivatives already recorded by a verified ready asset; no R2 objects move.
INSERT INTO gma_media_outputs(asset_id,relative,object_key)
SELECT a.id,o->>'relative',(a.metadata->>'hls_prefix')||(o->>'relative')
FROM gma_media_assets a CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.metadata->'outputs')='array' THEN a.metadata->'outputs' ELSE '[]'::jsonb END) o
WHERE a.provider='r2' AND a.state='ready' AND a.metadata->>'hls_prefix' LIKE 'media/'||a.id||'/hls/%'
ON CONFLICT(asset_id,relative) DO UPDATE SET object_key=excluded.object_key;

-- Bounded owner-only batch replaces one sequential HTTP/RPC call per asset in the studio.
CREATE OR REPLACE FUNCTION gma_video_asset_summaries(p_owner uuid,p_asset_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wanted integer;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 SELECT count(DISTINCT id) INTO wanted FROM unnest(COALESCE(p_asset_ids,'{}'::uuid[])) id;
 IF wanted>2000 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 IF (SELECT count(*) FROM gma_media_assets WHERE owner_id=p_owner AND id=ANY(p_asset_ids))<>wanted
   THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(a)||jsonb_build_object('metadata',a.metadata-'outputs') ORDER BY a.id),'[]'::jsonb)
   FROM gma_media_assets a WHERE a.owner_id=p_owner AND a.id=ANY(p_asset_ids));
END; $$;

-- Only server-authenticated identity may be passed by the API. Public title relation and
-- readiness are checked in the same SQL statement as indexed output membership.
CREATE OR REPLACE FUNCTION gma_video_output_authorized(p_asset_id uuid,p_relative text,p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('asset',jsonb_build_object(
   'id',a.id,'owner_id',a.owner_id,'provider',a.provider,'provider_ref',a.provider_ref,'state',a.state,'role',a.role,
   'metadata','{}'::jsonb,'delivery_path',a.delivery_path,'expected_input_bytes',a.expected_input_bytes,
   'received_bytes',a.received_bytes,'provider_reported_size',a.provider_reported_size,'duration_seconds',a.duration_seconds,
   'original_bytes',a.original_bytes,'processed_bytes',a.processed_bytes,'auxiliary_bytes',a.auxiliary_bytes),
   'key',o.object_key) INTO result
 FROM gma_media_assets a JOIN gma_media_outputs o ON o.asset_id=a.id AND o.relative=p_relative
 WHERE a.id=p_asset_id AND a.provider='r2' AND a.state='ready'
 AND (a.owner_id=p_owner OR EXISTS(SELECT 1 FROM gma_title_media tm JOIN peliculas p ON p.id=tm.title_id
   WHERE tm.asset_id=a.id AND p.status='published'));
 IF result IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN result;
END; $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('gma_video_command','gma_video_command_locked','gma_media_outputs_sync','gma_video_asset_summaries','gma_video_output_authorized') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
