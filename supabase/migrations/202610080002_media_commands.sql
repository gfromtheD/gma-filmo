-- Provider-private state and durable transport authority. No external services are called.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gma_upload_sessions' AND column_name='transfer_fence')
 THEN RAISE EXCEPTION 'MEDIA_SCHEMA_PREFLIGHT: apply 080001 first'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gma_media_provider_private (
 session_id uuid PRIMARY KEY REFERENCES public.gma_upload_sessions(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL UNIQUE REFERENCES public.gma_media_assets(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('r2','stream','mock','peertube')),
 upload_id text CHECK(length(upload_id) BETWEEN 1 AND 2048),
 private_state jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(private_state)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.gma_media_private_consistency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM gma_upload_sessions s JOIN gma_media_assets a ON a.id=s.asset_id AND a.owner_id=s.owner_id
   WHERE s.id=NEW.session_id AND s.asset_id=NEW.asset_id AND s.provider=NEW.provider AND a.provider=NEW.provider)
 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gma_media_private_consistency ON public.gma_media_provider_private;
CREATE TRIGGER gma_media_private_consistency BEFORE INSERT OR UPDATE ON public.gma_media_provider_private
 FOR EACH ROW EXECUTE FUNCTION public.gma_media_private_consistency();

CREATE TABLE IF NOT EXISTS public.gma_media_command_results (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 session_id uuid REFERENCES public.gma_upload_sessions(id),
 title_id bigint REFERENCES public.peliculas(id), action text NOT NULL,
 idempotency_key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,action,idempotency_key), CHECK(num_nonnulls(session_id,title_id)=1)
);
CREATE TABLE IF NOT EXISTS public.gma_media_upload_chunks (
 session_id uuid NOT NULL REFERENCES public.gma_upload_sessions(id) ON DELETE CASCADE,
 generation integer NOT NULL CHECK(generation>=1), start_byte bigint NOT NULL,
 end_byte bigint NOT NULL, sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 storage_relative text NOT NULL, writer_fence bigint NOT NULL CHECK(writer_fence>=1),
 upstream_confirmed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(session_id,generation,start_byte),
 CHECK(start_byte>=0 AND end_byte>=start_byte AND end_byte-start_byte+1<=16777216)
);

CREATE OR REPLACE FUNCTION public.gma_media_transfer_claim(p_owner uuid,p_session_id uuid,p_generation integer,p_writer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; current_offset bigint;
BEGIN
 IF p_owner IS NULL OR p_writer IS NULL OR length(p_writer) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF s.transfer_generation IS DISTINCT FROM p_generation THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF s.state NOT IN ('uploading','paused') OR now()>=s.expires_at OR EXISTS(SELECT 1 FROM gma_media_assets WHERE id=s.asset_id AND state IN ('deleting','deleted','rejected'))
   OR EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner)
 THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF s.transfer_lease_until>now() AND s.transfer_lease_owner IS DISTINCT FROM p_writer THEN RAISE EXCEPTION 'UPLOAD_WRITER_BUSY'; END IF;
 UPDATE gma_upload_sessions SET transfer_fence=transfer_fence+CASE WHEN transfer_lease_owner IS DISTINCT FROM p_writer OR transfer_lease_until IS NULL OR transfer_lease_until<=now() THEN 1 ELSE 0 END,
   transfer_lease_owner=p_writer,transfer_lease_until=now()+interval '30 seconds' WHERE id=s.id RETURNING * INTO s;
 SELECT COALESCE(max(end_byte)+1,0) INTO current_offset FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=p_generation;
 RETURN jsonb_build_object('fence',s.transfer_fence,'leaseUntil',s.transfer_lease_until,'offset',current_offset);
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_transfer_renew(p_owner uuid,p_session_id uuid,p_generation integer,p_writer text,p_fence bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions;
BEGIN
 UPDATE gma_upload_sessions us SET transfer_lease_until=now()+interval '30 seconds'
 WHERE us.id=p_session_id AND us.owner_id=p_owner AND us.transfer_generation=p_generation AND us.transfer_lease_owner=p_writer
   AND us.transfer_fence=p_fence AND us.transfer_lease_until>now() AND us.expires_at>now() AND us.state IN ('uploading','paused')
   AND NOT EXISTS(SELECT 1 FROM gma_media_assets a WHERE a.id=us.asset_id AND a.state IN ('deleting','deleted','rejected'))
   AND NOT EXISTS(SELECT 1 FROM gma_upload_account_deletions ad WHERE ad.owner_id=p_owner)
 RETURNING us.* INTO s;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 RETURN jsonb_build_object('fence',s.transfer_fence,'leaseUntil',s.transfer_lease_until);
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_transfer_release(p_owner uuid,p_session_id uuid,p_generation integer,p_writer text,p_fence bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed uuid;
BEGIN
 UPDATE gma_upload_sessions SET transfer_lease_owner=NULL,transfer_lease_until=NULL
 WHERE id=p_session_id AND owner_id=p_owner AND transfer_generation=p_generation AND transfer_lease_owner=p_writer
   AND transfer_fence=p_fence AND transfer_lease_until>now() RETURNING id INTO changed;
 IF changed IS NULL THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_transfer_commit(p_owner uuid,p_session_id uuid,p_generation integer,p_writer text,p_fence bigint,
 p_start_byte bigint,p_end_byte bigint,p_sha256 text,p_storage_relative text,p_upstream_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; c gma_media_upload_chunks; current_offset bigint; expected_path text;
BEGIN
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF s.transfer_generation IS DISTINCT FROM p_generation OR s.transfer_fence IS DISTINCT FROM p_fence
   OR s.transfer_lease_owner IS DISTINCT FROM p_writer OR s.transfer_lease_until IS NULL OR s.transfer_lease_until<=now()
 THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 IF s.state NOT IN ('uploading','paused') OR now()>=s.expires_at OR EXISTS(SELECT 1 FROM gma_media_assets WHERE id=s.asset_id AND state IN ('deleting','deleted','rejected'))
 THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 expected_path='transfer/'||s.id||'/'||p_generation||'/chunks/'||p_start_byte||'-'||p_end_byte||'-'||p_sha256||'.bin';
 IF p_start_byte IS NULL OR p_end_byte IS NULL OR p_start_byte<0 OR p_end_byte<p_start_byte OR p_end_byte>=s.expected_input_bytes
   OR p_end_byte-p_start_byte+1>16777216 OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$'
   OR p_storage_relative IS DISTINCT FROM expected_path OR p_upstream_confirmed IS NULL THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 SELECT * INTO c FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=p_generation AND start_byte=p_start_byte;
 IF FOUND THEN
   IF c.end_byte<>p_end_byte OR c.sha256<>p_sha256 OR c.storage_relative<>p_storage_relative THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   UPDATE gma_media_upload_chunks SET upstream_confirmed=upstream_confirmed OR p_upstream_confirmed
     WHERE session_id=s.id AND generation=p_generation AND start_byte=p_start_byte;
 ELSE
   SELECT COALESCE(max(end_byte)+1,0) INTO current_offset FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=p_generation;
   IF p_start_byte<>current_offset THEN RAISE EXCEPTION 'UPLOAD_RANGE_CONFLICT'; END IF;
   INSERT INTO gma_media_upload_chunks VALUES(s.id,p_generation,p_start_byte,p_end_byte,p_sha256,p_storage_relative,p_fence,p_upstream_confirmed);
 END IF;
 SELECT COALESCE(max(end_byte)+1,0) INTO current_offset FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=p_generation;
 RETURN jsonb_build_object('offset',current_offset,'upstreamOffset',(SELECT COALESCE(min(start_byte) FILTER (WHERE NOT upstream_confirmed),max(end_byte)+1,0)
   FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=p_generation));
END $$;

-- References are extended with retained title snapshots by 080003.
CREATE OR REPLACE FUNCTION public.gma_media_has_references(p_asset_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=p_asset_id)
 OR EXISTS(SELECT 1 FROM creator_profiles cp JOIN gma_media_assets a ON a.owner_id=cp.user_id AND a.delivery_path=cp.avatar_url WHERE a.id=p_asset_id);
$$;

CREATE OR REPLACE FUNCTION public.gma_media_heartbeat(p_job_id uuid,p_worker text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed uuid;
BEGIN
 UPDATE gma_upload_jobs j SET lease_until=now()+interval '120 seconds',updated_at=now()
 FROM gma_upload_sessions s JOIN gma_media_assets a ON a.id=s.asset_id
 WHERE j.id=p_job_id AND j.session_id=s.id AND j.kind IN ('verify','process') AND j.state='running'
 AND j.lease_owner=p_worker AND j.lease_until>now() AND s.state NOT IN ('cancelling','cancelled','expired')
 AND a.state NOT IN ('rejected','deleting','deleted') AND COALESCE((j.payload->>'processing_generation')::integer,1)=a.processing_generation
 RETURNING j.id INTO changed;
 IF changed IS NULL THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_command(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; a gma_media_assets; d gma_upload_drafts; j gma_upload_jobs;
 pv gma_media_provider_private; receipt jsonb; proof jsonb; snapshot jsonb; meta jsonb;
 target text; received bigint; duration double precision; current_generation integer; k text; seconds_used bigint;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 IF p_action='authorize_transfer' THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF s.transfer_generation IS DISTINCT FROM (p_payload->>'transfer_generation')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   IF s.state NOT IN ('uploading','paused') OR now()>=s.expires_at
     OR EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner)
     OR EXISTS(SELECT 1 FROM gma_media_assets WHERE id=s.asset_id AND state IN ('rejected','deleting','deleted'))
   THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
   RETURN to_jsonb(s);
 END IF;
 IF p_action NOT IN ('bind_upload','queue_verification','receipt','processing','ready','failed','retry','delete_confirmed') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 IF p_action='retry' THEN
   SELECT result INTO snapshot FROM gma_media_command_results WHERE owner_id=p_owner AND action='retry' AND idempotency_key=(p_payload->>'idempotency_key')::uuid;
   IF FOUND THEN
     IF NOT EXISTS(SELECT 1 FROM gma_media_command_results WHERE owner_id=p_owner AND action='retry' AND idempotency_key=(p_payload->>'idempotency_key')::uuid
       AND session_id=(p_payload->>'session_id')::uuid AND request_hash=p_payload->>'request_hash') THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     RETURN snapshot;
   END IF;
 END IF;
 IF p_action IN ('receipt','processing','ready','failed') THEN
   SELECT * INTO j FROM gma_upload_jobs WHERE id=(p_payload->>'job_id')::uuid FOR UPDATE;
 END IF;
 SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 SELECT * INTO d FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
 SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id AND owner_id=p_owner FOR UPDATE;
 SELECT * INTO pv FROM gma_media_provider_private WHERE session_id=s.id;
 current_generation=a.processing_generation;

 IF p_action='bind_upload' THEN
   IF jsonb_typeof(p_payload->'private_state') IS DISTINCT FROM 'object' OR length(COALESCE(p_payload->>'upload_id','')) NOT BETWEEN 1 AND 2048
      OR s.transfer_generation IS DISTINCT FROM (p_payload->>'transfer_generation')::integer
      OR (p_payload->'private_state') ?| ARRAY['receipt','receipt_transfer_generation','receipt_job_id','receipt_worker'] THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF pv.session_id IS NOT NULL AND pv.upload_id IS DISTINCT FROM p_payload->>'upload_id' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   IF a.provider_ref IS NOT NULL AND p_payload->>'provider_media_id' IS NOT NULL AND a.provider_ref<>p_payload->>'provider_media_id' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   INSERT INTO gma_media_provider_private(session_id,asset_id,provider,upload_id,private_state)
     VALUES(s.id,a.id,s.provider,p_payload->>'upload_id',p_payload->'private_state')
   ON CONFLICT(session_id) DO UPDATE SET private_state=gma_media_provider_private.private_state||excluded.private_state,updated_at=now();
   UPDATE gma_media_assets SET provider_ref=COALESCE(provider_ref,p_payload->>'provider_media_id') WHERE id=a.id;
   UPDATE gma_upload_sessions SET provider_ref=COALESCE(provider_ref,p_payload->>'provider_media_id'),
     state=CASE WHEN state='provisioning' THEN 'uploading' ELSE state END,
     revision=revision+CASE WHEN state='provisioning' OR (provider_ref IS NULL AND p_payload->>'provider_media_id' IS NOT NULL) THEN 1 ELSE 0 END,
     updated_at=CASE WHEN state='provisioning' OR (provider_ref IS NULL AND p_payload->>'provider_media_id' IS NOT NULL) THEN now() ELSE updated_at END
     WHERE id=s.id RETURNING * INTO s;
   RETURN to_jsonb(s);
 END IF;
 IF p_action='delete_confirmed' THEN
   IF s.quota_released THEN RETURN to_jsonb(s); END IF;
   IF a.state<>'deleting' OR s.state<>'cancelling' OR gma_media_has_references(a.id)
     OR EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts dr ON dr.id=dm.draft_id WHERE dm.asset_id=a.id AND dr.state='draft')
     OR p_payload->>'absent' IS DISTINCT FROM 'true' OR p_payload->>'writes_revoked' IS DISTINCT FROM 'true'
     OR (p_payload->>'safe_after')::timestamptz>now()
     OR (s.transfer_lease_until>now())
     OR pv.private_state->>'creation_pending'='true' OR pv.private_state->>'finalization_pending'='true'
     OR EXISTS(SELECT 1 FROM gma_upload_jobs WHERE session_id=s.id AND kind='provision' AND state IN ('pending','running'))
   THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   IF s.provider='r2' THEN RETURN gma_upload_command(p_owner,'delete_confirmed',p_payload); END IF;
   FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
     IF s.quota_confirmed THEN
       SELECT seconds INTO seconds_used FROM gma_upload_ledger WHERE session_id=s.id AND account_key=k AND event='confirm';
       UPDATE gma_upload_quota SET used_bytes=used_bytes-s.expected_input_bytes,used_seconds=used_seconds-seconds_used WHERE account_key=k;
     ELSE
       SELECT seconds INTO seconds_used FROM gma_upload_ledger WHERE session_id=s.id AND account_key=k AND event='reserve';
       UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,reserved_seconds=reserved_seconds-seconds_used WHERE account_key=k;
     END IF;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'release',s.expected_input_bytes,seconds_used);
   END LOOP;
   UPDATE gma_media_assets SET state='deleted',revision=revision+1,updated_at=now() WHERE id=a.id;
   DELETE FROM gma_draft_media WHERE asset_id=a.id;
   UPDATE gma_upload_sessions SET state='cancelled',quota_released=true,revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   RETURN to_jsonb(s);
 END IF;
 IF p_action='queue_verification' THEN
   IF a.state='ready' THEN RETURN to_jsonb(a); END IF;
   IF s.state NOT IN ('uploading','paused','uploaded') OR a.state IN ('failed','rejected','deleting','deleted') OR d.state<>'draft'
     OR EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
   IF s.transfer_generation IS DISTINCT FROM (p_payload->>'transfer_generation')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   IF pv.upload_id IS NULL THEN RAISE EXCEPTION 'UPLOAD_PROVISION_RECOVERY_REQUIRED'; END IF;
   IF p_payload ? 'proof' OR p_payload ? 'receipt' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   PERFORM gma_upload_enqueue_job('verify',s.id,jsonb_build_object('processing_generation',a.processing_generation),'verify:'||s.id||':'||a.processing_generation,now());
   RETURN to_jsonb(a);
 END IF;
 IF p_action='retry' THEN
   IF COALESCE(p_payload->>'request_hash','') !~ '^[a-f0-9]{64}$' OR p_payload->>'idempotency_key' IS NULL THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   SELECT result INTO snapshot FROM gma_media_command_results WHERE owner_id=p_owner AND action='retry' AND idempotency_key=(p_payload->>'idempotency_key')::uuid;
   IF FOUND THEN
     IF NOT EXISTS(SELECT 1 FROM gma_media_command_results WHERE owner_id=p_owner AND action='retry' AND idempotency_key=(p_payload->>'idempotency_key')::uuid
       AND session_id=s.id AND request_hash=p_payload->>'request_hash') THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     RETURN snapshot;
   END IF;
   IF EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) OR d.state<>'draft' OR a.state<>'failed' OR NOT a.error_retryable
      OR s.state<>'uploaded' OR NOT (pv.private_state ? 'receipt') OR gma_media_has_references(a.id) THEN RAISE EXCEPTION 'UPLOAD_RETRY_UNAVAILABLE'; END IF;
   IF s.provider='stream' THEN RAISE EXCEPTION 'UPLOAD_PROTOCOL_UNSUPPORTED'; END IF;
   IF s.retry_count>=3 THEN RAISE EXCEPTION 'UPLOAD_RETRY_LIMIT'; END IF;
   IF s.revision IS DISTINCT FROM (p_payload->>'revision')::integer OR a.revision IS DISTINCT FROM (p_payload->>'asset_revision')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_jobs SET state='dead',lease_owner=NULL,lease_until=NULL,last_error='UPLOAD_GENERATION_SUPERSEDED',updated_at=now()
     WHERE session_id=s.id AND kind IN ('process','verify') AND state IN ('pending','running');
   UPDATE gma_upload_sessions SET retry_count=retry_count+1,last_error_code=NULL,revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   UPDATE gma_media_assets SET state='processing',processing_generation=processing_generation+1,error_code=NULL,error_retryable=false,revision=revision+1,updated_at=now() WHERE id=a.id RETURNING * INTO a;
   target=CASE WHEN s.provider='peertube' OR s.max_duration_seconds=0 THEN 'verify' ELSE 'process' END;
   PERFORM gma_upload_enqueue_job(target,s.id,jsonb_build_object('processing_generation',a.processing_generation),target||':'||s.id||':'||a.processing_generation,now());
   snapshot=jsonb_build_object('session',to_jsonb(s),'asset',to_jsonb(a));
   INSERT INTO gma_media_command_results(owner_id,session_id,action,idempotency_key,request_hash,result)
     VALUES(p_owner,s.id,'retry',(p_payload->>'idempotency_key')::uuid,p_payload->>'request_hash',snapshot);
   RETURN snapshot;
 END IF;
 IF j.id IS NULL OR j.session_id IS DISTINCT FROM s.id OR j.kind NOT IN ('verify','process')
   OR (p_action<>'receipt' AND j.kind IS DISTINCT FROM CASE WHEN s.max_duration_seconds>0 AND s.provider IN ('mock','r2') THEN 'process' ELSE 'verify' END)
   OR COALESCE((j.payload->>'processing_generation')::integer,1)<>a.processing_generation
   OR (p_payload->>'processing_generation')::integer IS DISTINCT FROM a.processing_generation
 THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 -- A committed receipt can be replayed after its verify lease finished, without mutation.
 IF p_action='receipt' AND pv.private_state ? 'receipt' THEN
   IF (pv.private_state->>'receipt_transfer_generation')::integer IS DISTINCT FROM (p_payload->>'transfer_generation')::integer
     OR pv.private_state->'receipt' IS DISTINCT FROM p_payload->'receipt' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   IF j.kind<>'verify' OR pv.private_state->>'receipt_job_id' IS DISTINCT FROM j.id::text
     OR pv.private_state->>'receipt_worker' IS DISTINCT FROM p_payload->>'worker'
     OR j.state NOT IN ('running','done') THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
   RETURN to_jsonb(a);
 END IF;
 IF j.state<>'running' OR j.lease_owner IS DISTINCT FROM p_payload->>'worker' OR j.lease_until IS NULL OR j.lease_until<=now() THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 IF a.state='ready' THEN RETURN to_jsonb(a); END IF;
 IF a.state IN ('rejected','deleting','deleted') OR s.state IN ('cancelling','cancelled','expired') THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF a.revision IS DISTINCT FROM (p_payload->>'expected_asset_revision')::integer THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;

 IF p_action='receipt' THEN
   receipt=p_payload->'receipt'; proof=receipt->'proof';
   IF j.kind<>'verify' OR pv.upload_id IS NULL OR s.transfer_generation IS DISTINCT FROM (p_payload->>'transfer_generation')::integer
     OR s.state NOT IN ('uploading','paused','uploaded') OR a.state<>'received'
     OR receipt->>'complete' IS DISTINCT FROM 'true' OR (receipt->>'receivedBytes')::bigint IS DISTINCT FROM s.expected_input_bytes
   THEN RAISE EXCEPTION 'UPLOAD_NOT_COMPLETE'; END IF;
   IF s.provider='mock' THEN
     IF proof->>'kind' IS DISTINCT FROM 'mock-sha256' OR (proof->>'size')::bigint IS DISTINCT FROM s.expected_input_bytes
       OR proof->>'sha256' IS DISTINCT FROM s.source_sha256 OR receipt->>'sourceSha256' IS DISTINCT FROM s.source_sha256
       OR receipt->>'identity' IS DISTINCT FROM 'sha256' OR (proof->>'transferGeneration')::integer IS DISTINCT FROM s.transfer_generation
       OR COALESCE(proof->>'chunkManifestHash','') !~ '^[a-f0-9]{64}$'
       OR (SELECT COALESCE(sum(end_byte-start_byte+1),0) FROM gma_media_upload_chunks WHERE session_id=s.id AND generation=s.transfer_generation)<>s.expected_input_bytes
     THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
   ELSIF s.provider='r2' THEN
     IF proof->>'kind' IS DISTINCT FROM 'r2-receipt' OR (proof->>'size')::bigint IS DISTINCT FROM s.expected_input_bytes
       OR proof->>'objectKey' IS DISTINCT FROM s.object_key OR length(COALESCE(proof->>'etag',''))=0
       OR receipt->>'identity' IS DISTINCT FROM 'provider-receipt' OR COALESCE(proof->>'completedPartsHash','') !~ '^[a-f0-9]{64}$'
     THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
   ELSIF s.provider='stream' THEN
     IF proof->>'kind' IS DISTINCT FROM 'stream-receipt' OR proof->>'uid' IS DISTINCT FROM a.provider_ref
       OR (proof->>'receivedBytes')::bigint IS DISTINCT FROM s.expected_input_bytes OR receipt->>'identity' IS DISTINCT FROM 'provider-receipt'
       OR receipt->>'sourceSha256' IS NOT NULL THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
   ELSE
     IF proof->>'kind' IS DISTINCT FROM 'peertube-gateway' OR proof->>'uploadId' IS DISTINCT FROM pv.upload_id
       OR (proof->>'totalBytes')::bigint IS DISTINCT FROM s.expected_input_bytes OR (proof->>'upstreamReceivedBytes')::bigint IS DISTINCT FROM s.expected_input_bytes
       OR proof->>'gmaSha256' IS DISTINCT FROM s.source_sha256 OR receipt->>'sourceSha256' IS DISTINCT FROM s.source_sha256
       OR receipt->>'identity' IS DISTINCT FROM 'sha256' OR proof->>'videoUUID' IS DISTINCT FROM receipt->>'providerMediaId'
       OR COALESCE(proof->>'videoUUID','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       OR proof->>'correlationName' IS DISTINCT FROM 'gma-'||a.id||'-a'||s.transfer_generation
       OR proof->>'finalizingAt' IS NULL THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
     IF a.provider_ref IS NOT NULL AND a.provider_ref<>proof->>'videoUUID' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     UPDATE gma_media_assets SET provider_ref=proof->>'videoUUID' WHERE id=a.id;
     UPDATE gma_upload_sessions SET provider_ref=proof->>'videoUUID' WHERE id=s.id;
   END IF;
   UPDATE gma_media_provider_private SET private_state=private_state||jsonb_build_object('receipt',receipt,'receipt_transfer_generation',s.transfer_generation,'receipt_job_id',j.id,'receipt_worker',j.lease_owner),updated_at=now() WHERE session_id=s.id;
   UPDATE gma_upload_sessions SET state='uploaded',revision=revision+1,updated_at=now() WHERE id=s.id;
   UPDATE gma_media_assets SET state='validating',received_bytes=s.expected_input_bytes,original_bytes=CASE WHEN s.max_duration_seconds>0 THEN s.expected_input_bytes ELSE original_bytes END,
     revision=revision+1,updated_at=now() WHERE id=a.id RETURNING * INTO a;
   IF s.max_duration_seconds>0 AND s.provider IN ('mock','r2') THEN
     PERFORM gma_upload_enqueue_job('process',s.id,jsonb_build_object('processing_generation',a.processing_generation),'process:'||s.id||':'||a.processing_generation,now());
     UPDATE gma_upload_jobs SET state='done',updated_at=now() WHERE id=j.id;
   END IF;
   RETURN to_jsonb(a);
 END IF;
 IF NOT (pv.private_state ? 'receipt') THEN RAISE EXCEPTION 'UPLOAD_NOT_COMPLETE'; END IF;
 IF p_action='processing' THEN
   IF a.state NOT IN ('validating','processing') OR s.state<>'uploaded'
     OR (p_payload ? 'metadata' AND jsonb_typeof(p_payload->'metadata') IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE gma_media_assets SET state='processing',metadata=metadata||COALESCE(p_payload->'metadata','{}'),revision=revision+1,updated_at=now() WHERE id=a.id RETURNING * INTO a;
   RETURN to_jsonb(a);
 END IF;
 IF p_action='failed' THEN
   IF a.state NOT IN ('validating','processing') OR jsonb_typeof(p_payload->'retryable') IS DISTINCT FROM 'boolean'
     OR COALESCE(p_payload->>'error_code','') !~ '^[A-Z][A-Z0-9_]{0,99}$' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE gma_media_assets SET state=CASE WHEN p_payload->>'retryable'='true' THEN 'failed' ELSE 'rejected' END,error_code=p_payload->>'error_code',
     error_retryable=(p_payload->>'retryable'='true'),revision=revision+1,updated_at=now() WHERE id=a.id RETURNING * INTO a;
   UPDATE gma_upload_sessions SET last_error_code=p_payload->>'error_code',revision=revision+1,updated_at=now() WHERE id=s.id;
   UPDATE gma_upload_jobs SET state='dead',last_error=p_payload->>'error_code',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
   IF a.state='rejected' THEN PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id)); END IF;
   RETURN to_jsonb(a);
 END IF;
 snapshot=p_payload->'snapshot'; meta=snapshot->'metadata'; duration=(snapshot->>'durationSeconds')::double precision;
 IF a.state NOT IN ('validating','processing') OR s.state<>'uploaded' OR snapshot->>'status' IS DISTINCT FROM 'ready'
   OR snapshot->>'playbackVerified' IS DISTINCT FROM 'true' OR (snapshot->>'receivedBytes')::bigint IS DISTINCT FROM s.expected_input_bytes
   OR jsonb_typeof(meta) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'UPLOAD_PROCESSING_UNVERIFIED'; END IF;
 IF s.max_duration_seconds>0 THEN
   IF duration IS NULL OR NOT (duration>0 AND duration<=s.max_duration_seconds) THEN RAISE EXCEPTION 'UPLOAD_PROCESSING_UNVERIFIED'; END IF;
   IF s.provider IN ('r2','mock') AND (meta->>'source_sha256' IS DISTINCT FROM s.source_sha256 OR meta->>'outputs_verified' IS DISTINCT FROM 'true'
     OR COALESCE((meta->>'processed_bytes')::bigint,0)<=0 OR jsonb_typeof(meta->'outputs') IS DISTINCT FROM 'array') THEN RAISE EXCEPTION 'UPLOAD_PROCESSING_UNVERIFIED'; END IF;
 ELSE
   IF COALESCE((meta->>'normalized_bytes')::bigint,0)<=0 OR meta->>'source_sha256' IS DISTINCT FROM s.source_sha256
      OR meta->>'mime' NOT IN ('image/webp','text/vtt') THEN RAISE EXCEPTION 'UPLOAD_PROCESSING_UNVERIFIED'; END IF;
 END IF;
 IF NOT s.quota_confirmed THEN
   seconds_used=CASE WHEN s.provider='stream' THEN ceil(duration)::bigint ELSE 0 END;
   FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
     UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,used_bytes=used_bytes+s.expected_input_bytes,
       reserved_seconds=reserved_seconds-CASE WHEN s.provider='stream' THEN s.max_duration_seconds ELSE 0 END,used_seconds=used_seconds+seconds_used WHERE account_key=k;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'confirm',s.expected_input_bytes,seconds_used);
   END LOOP;
   UPDATE gma_upload_sessions SET quota_confirmed=true WHERE id=s.id;
 END IF;
 UPDATE gma_media_assets SET state='ready',duration_seconds=duration,metadata=meta,delivery_path=COALESCE(p_payload->>'delivery_path','/api/media/'||a.id),
   original_bytes=CASE WHEN s.max_duration_seconds>0 THEN s.expected_input_bytes ELSE original_bytes END,
   processed_bytes=(meta->>'processed_bytes')::bigint,auxiliary_bytes=(meta->>'normalized_bytes')::bigint,
   verified_at=now(),error_code=NULL,error_retryable=false,revision=revision+1,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 RETURN to_jsonb(a);
END $$;

-- Wrap audited legacy implementations; do not edit historical migration files.
DO $$ BEGIN
 IF to_regprocedure('public.gma_upload_command_v2_compat(uuid,text,jsonb)') IS NULL THEN
   ALTER FUNCTION public.gma_upload_command(uuid,text,jsonb) RENAME TO gma_upload_command_v2_compat;
 END IF;
 IF to_regprocedure('public.gma_video_command_locked_v2_compat(uuid,text,jsonb)') IS NULL THEN
   ALTER FUNCTION public.gma_video_command_locked(uuid,text,jsonb) RENAME TO gma_video_command_locked_v2_compat;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.gma_upload_command(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; a gma_media_assets;
BEGIN
 IF p_action='reserve' THEN RETURN gma_media_reserve(p_owner,p_payload); END IF;
 IF p_action IN ('observe','cancel','bind','intent','receipt','delete_confirmed') THEN
   PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
   SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   PERFORM 1 FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
   SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
   IF p_action<>'cancel' AND s.provider IN ('mock','peertube') THEN RAISE EXCEPTION 'UPLOAD_PROTOCOL_UNSUPPORTED'; END IF;
   IF p_action='observe' AND a.state IN ('ready','rejected','deleting','deleted') THEN RETURN to_jsonb(a); END IF;
   IF p_action='cancel' AND gma_media_has_references(a.id) THEN RAISE EXCEPTION 'UPLOAD_ASSET_IN_USE'; END IF;
 END IF;
 RETURN gma_upload_command_v2_compat(p_owner,p_action,p_payload);
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_reserve(p_owner uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
   WHEN 'poster' THEN 10485760 WHEN 'poster_h' THEN 10485760 WHEN 'poster_v' THEN 10485760 WHEN 'subtitles' THEN 5242880 WHEN 'avatar' THEN 5242880 ELSE 0 END;
 IF b IS NULL OR b<1 OR b>cap OR cap=0 OR COALESCE(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR COALESCE(length(p_payload->>'file_name'),0) NOT BETWEEN 1 AND 255 OR COALESCE(length(p_payload->>'content_type'),0) NOT BETWEEN 1 AND 100
   OR COALESCE(length(p_payload->>'idempotency_key'),0) NOT BETWEEN 1 AND 120 OR COALESCE(length(p_payload->>'request_hash'),0) NOT BETWEEN 1 AND 200
   OR (p_payload->>'language' IS NOT NULL AND p_payload->>'language' !~ '^[a-zA-Z0-9-]{2,35}$') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 IF (d.purpose='avatar')<>(r='avatar') OR (d.purpose='title' AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner)) THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.gma_video_command_locked(p_owner uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; a gma_media_assets; j gma_upload_jobs;
BEGIN
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 IF p_action IN ('heartbeat','start','processing','ready','failed') THEN
   SELECT * INTO j FROM gma_upload_jobs WHERE id=(p_payload->>'job_id')::uuid FOR UPDATE;
   IF j.id IS NULL OR j.state<>'running' OR j.lease_owner IS DISTINCT FROM p_payload->>'worker' OR j.lease_until IS NULL OR j.lease_until<=now() THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 END IF;
 SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 PERFORM 1 FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
 SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
 IF j.id IS NOT NULL AND (j.session_id IS DISTINCT FROM s.id OR COALESCE((j.payload->>'processing_generation')::integer,1)<>a.processing_generation) THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 IF a.state='ready' AND p_action IN ('processing','failed','ready','uploaded','start') THEN RETURN to_jsonb(a); END IF;
 IF p_action='processing' AND a.state NOT IN ('validating','processing') THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF p_action='failed' AND p_payload->>'terminal'='true'
   AND EXISTS(SELECT 1 FROM gma_media_provider_private WHERE session_id=s.id AND private_state ? 'receipt')
   AND COALESCE(p_payload->>'error','') !~ 'IDENTITY_INVALID|METADATA_INVALID|HLS_INCOMPLETE|OUTPUT_INVALID|OUTPUT_TOO_LARGE|RESOURCE_LIMIT|TOOL_OUTPUT_TOO_LARGE'
 THEN
   RETURN gma_media_command(p_owner,'failed',jsonb_build_object('session_id',s.id,'job_id',j.id,'worker',j.lease_owner,
     'processing_generation',a.processing_generation,'expected_asset_revision',a.revision,'error_code',COALESCE(p_payload->>'error','MEDIA_PROCESSING_FAILED'),'retryable',true));
 END IF;
 RETURN gma_video_command_locked_v2_compat(p_owner,p_action,p_payload);
END $$;

CREATE OR REPLACE FUNCTION public.gma_upload_schedule() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; j gma_upload_jobs; a gma_media_assets; n integer:=0; has_receipt boolean;
BEGIN
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 FOR j IN SELECT * FROM gma_upload_jobs WHERE state='running' AND lease_until<now() AND attempts>=12 ORDER BY id FOR UPDATE LOOP
   SELECT * INTO s FROM gma_upload_sessions WHERE id=j.session_id FOR UPDATE;
   PERFORM 1 FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
   SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
   UPDATE gma_upload_jobs SET state='dead',last_error='UPLOAD_WORKER_EXHAUSTED',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
   IF a.id IS NULL OR a.state IN ('ready','rejected','deleting','deleted') OR COALESCE((j.payload->>'processing_generation')::integer,1)<>a.processing_generation THEN CONTINUE; END IF;
   SELECT EXISTS(SELECT 1 FROM gma_media_provider_private WHERE session_id=s.id AND private_state ? 'receipt') INTO has_receipt;
   IF j.kind IN ('process','verify') AND has_receipt THEN
     UPDATE gma_media_assets SET state='failed',error_code='MEDIA_PROCESSING_FAILED',error_retryable=(s.provider<>'stream'),revision=revision+1,updated_at=now() WHERE id=a.id;
     UPDATE gma_upload_sessions SET last_error_code='MEDIA_PROCESSING_FAILED',revision=revision+1,updated_at=now() WHERE id=s.id;
   ELSIF j.kind='process' AND s.provider='r2' THEN
     UPDATE gma_upload_jobs SET last_error='VIDEO_WORKER_EXHAUSTED' WHERE id=j.id;
     UPDATE gma_media_assets SET metadata=metadata||jsonb_build_object('reason','VIDEO_WORKER_EXHAUSTED') WHERE id=a.id;
     PERFORM gma_upload_command(s.owner_id,'cancel',jsonb_build_object('session_id',s.id));
   ELSE
     UPDATE gma_upload_sessions SET last_error_code='UPLOAD_WORKER_EXHAUSTED',updated_at=now() WHERE id=s.id;
   END IF;
 END LOOP;
 FOR s IN SELECT us.* FROM gma_upload_sessions us WHERE NOT quota_released AND updated_at<now()-interval '1 minute'
   AND NOT EXISTS(SELECT 1 FROM gma_upload_jobs live WHERE live.session_id=us.id AND live.state IN ('pending','running'))
   ORDER BY updated_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
   PERFORM gma_upload_enqueue_job('reconcile',s.id,jsonb_build_object('processing_generation',(SELECT processing_generation FROM gma_media_assets WHERE id=s.asset_id)),
     'reconcile:'||s.id||':'||extract(epoch from now())::text,now());
   UPDATE gma_upload_sessions SET updated_at=now() WHERE id=s.id; n=n+1;
 END LOOP;
 RETURN n;
END $$;

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['gma_media_provider_private','gma_media_command_results','gma_media_upload_chunks'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname LIKE 'gma_media_%' OR p.proname IN ('gma_upload_command','gma_upload_command_v2_compat','gma_video_command_locked','gma_video_command_locked_v2_compat','gma_upload_schedule')) LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
