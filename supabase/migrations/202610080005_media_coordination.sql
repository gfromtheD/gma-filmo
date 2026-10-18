BEGIN;
-- Additive server-only coordination. No receipt/READY authority is delegated to the browser.
CREATE OR REPLACE FUNCTION public.gma_media_provision_intent(p_owner uuid,p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; fresh boolean;
BEGIN
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF s.state<>'provisioning' THEN RETURN false; END IF;
 fresh=COALESCE(s.provider_data->>'provision_started','false')<>'true';
 UPDATE gma_upload_sessions SET provider_data=provider_data||jsonb_build_object('provision_started',true),updated_at=now() WHERE id=s.id;
 RETURN fresh;
END $$;
REVOKE ALL ON FUNCTION public.gma_media_provision_intent(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_provision_intent(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gma_media_job_control(p_job_id uuid,p_worker text,p_action text,p_generation integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j gma_upload_jobs; a gma_media_assets;
BEGIN
 SELECT * INTO j FROM gma_upload_jobs WHERE id=p_job_id FOR UPDATE;
 SELECT ma.* INTO a FROM gma_media_assets ma JOIN gma_upload_sessions us ON us.asset_id=ma.id WHERE us.id=j.session_id;
 IF j.state<>'running' OR j.lease_owner IS DISTINCT FROM p_worker OR j.lease_until<=now()
   OR a.processing_generation IS DISTINCT FROM p_generation OR (j.kind IN ('verify','process','provision') AND a.state IN ('deleting','deleted','rejected')) THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 IF p_action='heartbeat' THEN UPDATE gma_upload_jobs SET lease_until=now()+interval '120 seconds',updated_at=now() WHERE id=j.id;
 ELSIF p_action='poll' THEN UPDATE gma_upload_jobs SET state='pending',attempts=GREATEST(0,attempts-1),run_after=now()+interval '10 seconds',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
 ELSE RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.gma_media_claim_job(p_worker text,p_allow_mock_process boolean,p_r2_process_only boolean DEFAULT false) RETURNS gma_upload_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j gma_upload_jobs;
BEGIN
 SELECT uj.* INTO j FROM gma_upload_jobs uj JOIN gma_upload_sessions us ON us.id=uj.session_id
 WHERE ((uj.state='pending' AND uj.run_after<=now()) OR (uj.state='running' AND uj.lease_until<now())) AND uj.attempts<12
 AND CASE WHEN p_r2_process_only THEN uj.kind='process' AND us.provider='r2'
   ELSE uj.kind<>'process' OR (p_allow_mock_process AND us.provider='mock') END
 ORDER BY uj.run_after,uj.id FOR UPDATE OF uj SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE gma_upload_jobs SET state='running',attempts=attempts+1,lease_owner=p_worker,lease_until=now()+interval '120 seconds',updated_at=now()
 WHERE id=j.id RETURNING * INTO j;RETURN j;
END $$;
CREATE OR REPLACE FUNCTION public.gma_media_auxiliary_key() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.provider='r2' AND NEW.max_duration_seconds=0 AND NEW.object_key IS NULL THEN NEW.object_key='ingest/'||NEW.owner_id||'/'||NEW.id; END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS gma_media_auxiliary_key ON gma_upload_sessions;
CREATE TRIGGER gma_media_auxiliary_key BEFORE INSERT ON gma_upload_sessions FOR EACH ROW EXECUTE FUNCTION gma_media_auxiliary_key();
UPDATE gma_upload_sessions SET object_key='ingest/'||owner_id||'/'||id WHERE provider='r2' AND max_duration_seconds=0 AND object_key IS NULL;
REVOKE ALL ON FUNCTION public.gma_media_job_control(uuid,text,text,integer),public.gma_media_claim_job(text,boolean,boolean),public.gma_media_auxiliary_key() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_job_control(uuid,text,text,integer),public.gma_media_claim_job(text,boolean,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.gma_media_outputs_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prefix text; outputs jsonb; item jsonb; rel text; bytes bigint; mime text; expected_prefix text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.processing_generation<>OLD.processing_generation AND NEW.state<>'ready' THEN
   DELETE FROM gma_media_outputs WHERE asset_id=NEW.id;
 END IF;
 IF NEW.state IN ('deleting','deleted') THEN
   DELETE FROM gma_media_outputs WHERE asset_id=NEW.id;
   RETURN NEW;
 END IF;
 IF NEW.provider NOT IN ('r2','mock') OR NEW.state<>'ready' OR NOT (NEW.metadata ? 'outputs') THEN RETURN NEW; END IF;
 outputs=NEW.metadata->'outputs';
 IF jsonb_typeof(outputs)<>'array' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 prefix=NEW.metadata->>'hls_prefix';
 IF NEW.provider='r2' THEN
   IF prefix IS NULL OR prefix NOT LIKE 'media/'||NEW.id||'/hls/%' OR prefix ~ '(^|/)\.\.?(/|$)' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 ELSE
   expected_prefix='mock/'||NEW.id||'/'||NEW.processing_generation||'/';
   IF prefix IS DISTINCT FROM expected_prefix THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 END IF;
 DELETE FROM gma_media_outputs WHERE asset_id=NEW.id;
 FOR item IN SELECT value FROM jsonb_array_elements(outputs) LOOP
   rel=item->>'relative';
   IF COALESCE(length(rel),0) NOT BETWEEN 1 AND 512 OR rel !~ '^[a-zA-Z0-9_./-]+$' OR rel ~ '(^/|(^|/)\.\.?(/|$)|//)'
     THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   bytes=COALESCE((item->>'bytes')::bigint,(item->>'size_bytes')::bigint);
   mime=COALESCE(item->>'mime',item->>'mime_type');
   IF NEW.provider='mock' AND (bytes IS NULL OR bytes<=0 OR mime NOT IN ('application/vnd.apple.mpegurl','application/x-mpegURL','video/mp2t','video/iso.segment','video/mp4','image/webp','text/vtt'))
     THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF NEW.provider='r2' AND ((bytes IS NOT NULL AND bytes<0) OR (mime IS NOT NULL AND length(mime)>127)) THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   INSERT INTO gma_media_outputs(asset_id,relative,object_key,mime_type,size_bytes)
     VALUES(NEW.id,rel,prefix||rel,mime,bytes);
 END LOOP;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
-- CAS shared by every neutral transfer action; never release quota here.
CREATE OR REPLACE FUNCTION public.gma_media_transfer_action(p_owner uuid,p_session_id uuid,p_action text,p_revision integer,p_sha256 text DEFAULT NULL,p_bytes bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; a gma_media_assets;
BEGIN
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
 IF p_action NOT IN ('pause','resume','cancel') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 IF p_action='cancel' AND s.state IN ('cancelling','cancelled','expired') THEN RETURN to_jsonb(s); END IF;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='cancel' THEN RETURN gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id)); END IF;
 IF s.expires_at<=now() OR s.state NOT IN ('uploading','paused') OR a.state IN ('deleting','deleted','rejected','failed') THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF p_action='resume' AND (s.source_sha256 IS DISTINCT FROM p_sha256 OR s.expected_input_bytes IS DISTINCT FROM p_bytes) THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
 IF (p_action='pause' AND s.state='paused') OR (p_action='resume' AND s.state='uploading') THEN RETURN to_jsonb(s); END IF;
 RETURN gma_upload_command(p_owner,'pause',jsonb_build_object('session_id',s.id,'paused',p_action='pause'));
END $$;
REVOKE ALL ON FUNCTION public.gma_media_transfer_action(uuid,uuid,text,integer,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_transfer_action(uuid,uuid,text,integer,text,bigint) TO service_role;
CREATE OR REPLACE FUNCTION public.gma_media_cleanup_allowed(p_owner uuid,p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions;
BEGIN
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner;
 IF s.id IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN s.state='cancelling' AND NOT gma_media_has_references(s.asset_id)
 AND NOT EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id WHERE dm.asset_id=s.asset_id AND d.state='draft')
 AND NOT (COALESCE(s.transfer_lease_until,'epoch')>now())
 AND NOT EXISTS(SELECT 1 FROM gma_upload_jobs WHERE session_id=s.id AND (kind='provision' AND state IN ('pending','running') OR kind IN ('verify','process') AND state='running' AND lease_until>now()));
END $$;
REVOKE ALL ON FUNCTION public.gma_media_cleanup_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_cleanup_allowed(uuid,uuid) TO service_role;
-- HTTP creation status must be elected atomically with the reservation, even for concurrent replay.
CREATE OR REPLACE FUNCTION public.gma_media_reserve_result(p_owner uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existed boolean; result jsonb;
BEGIN
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 existed=EXISTS(SELECT 1 FROM gma_upload_sessions WHERE owner_id=p_owner AND idempotency_key=p_payload->>'idempotency_key');
 result=gma_upload_command(p_owner,'reserve',p_payload);
 RETURN jsonb_build_object('created',NOT existed,'session',result);
END $$;
REVOKE ALL ON FUNCTION public.gma_media_reserve_result(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_reserve_result(uuid,jsonb) TO service_role;
-- Exhausted exceptions must be visible as a media failure, not a permanently processing dead job.
CREATE OR REPLACE FUNCTION public.gma_media_finish_job(p_job_id uuid,p_worker text,p_success boolean,p_error text,p_retry_after timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j gma_upload_jobs; s gma_upload_sessions; a gma_media_assets; result boolean;
BEGIN
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO j FROM gma_upload_jobs WHERE id=p_job_id FOR UPDATE;
 result=gma_upload_finish_job(p_job_id,p_worker,p_success,p_error,p_retry_after);
 IF NOT p_success AND j.attempts>=12 THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE id=j.session_id FOR UPDATE;
   PERFORM 1 FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
   SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
   IF a.state NOT IN ('ready','rejected','deleting','deleted') AND s.state NOT IN ('cancelling','cancelled','expired')
      AND COALESCE((j.payload->>'processing_generation')::integer,a.processing_generation)=a.processing_generation THEN
     UPDATE gma_upload_sessions SET last_error_code=COALESCE(p_error,'UPLOAD_WORKER_EXHAUSTED'),revision=revision+1,updated_at=now() WHERE id=s.id;
     UPDATE gma_media_assets SET state=CASE WHEN state IN ('validating','processing')
        AND j.kind IN ('verify','process') AND EXISTS(SELECT 1 FROM gma_media_provider_private WHERE session_id=s.id AND private_state ? 'receipt') THEN 'failed' ELSE state END,
       error_code=COALESCE(p_error,'UPLOAD_WORKER_EXHAUSTED'),error_retryable=(j.kind IN ('verify','process') AND s.provider<>'stream'
         AND EXISTS(SELECT 1 FROM gma_media_provider_private WHERE session_id=s.id AND private_state ? 'receipt')),revision=revision+1,updated_at=now() WHERE id=a.id;
   END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.gma_media_finish_job(uuid,text,boolean,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_finish_job(uuid,text,boolean,text,timestamptz) TO service_role;
COMMIT;
