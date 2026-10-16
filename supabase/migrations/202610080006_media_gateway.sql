-- Fenced private gateway checkpoints, additive. No remote or legacy data mutation.
BEGIN;
CREATE OR REPLACE FUNCTION public.gma_media_gateway_state(p_owner uuid,p_session_id uuid,p_generation integer,p_writer text,p_fence bigint,p_patch jsonb,p_provider_media_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; upload_id text;
BEGIN
 -- Same lock order as the neutral command: global, session, draft, asset.
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO s FROM gma_upload_sessions WHERE id=p_session_id AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF s.transfer_generation IS DISTINCT FROM p_generation OR s.transfer_fence IS DISTINCT FROM p_fence
 OR s.transfer_lease_owner IS DISTINCT FROM p_writer OR s.transfer_lease_until IS NULL OR s.transfer_lease_until<=now()
 THEN RAISE EXCEPTION 'UPLOAD_LEASE_LOST'; END IF;
 IF s.state NOT IN ('uploading','paused') OR s.expires_at<=now()
 OR EXISTS(SELECT 1 FROM gma_media_assets WHERE id=s.asset_id AND state IN ('deleting','deleted','rejected'))
 OR EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_CANCELLED'; END IF;
 IF s.provider NOT IN ('mock','peertube') OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('provisional_receipt','finalization_pending','finalizingAt','videoUUID','upstreamOffset','localOffset','sourceSha256'))
 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 IF p_patch ? 'sourceSha256' AND p_patch->>'sourceSha256' IS DISTINCT FROM s.source_sha256 THEN RAISE EXCEPTION 'UPLOAD_SOURCE_MISMATCH'; END IF;
 SELECT pv.upload_id INTO upload_id FROM gma_media_provider_private pv WHERE pv.session_id=s.id;
 IF upload_id IS NULL THEN RAISE EXCEPTION 'UPLOAD_PROVISION_RECOVERY_REQUIRED'; END IF;
 PERFORM gma_media_command(p_owner,'bind_upload',jsonb_build_object('session_id',s.id,'transfer_generation',p_generation,
 'upload_id',upload_id,'provider_media_id',p_provider_media_id,'private_state',p_patch));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.gma_media_gateway_state(uuid,uuid,integer,text,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_gateway_state(uuid,uuid,integer,text,bigint,jsonb,text) TO service_role;
COMMIT;
