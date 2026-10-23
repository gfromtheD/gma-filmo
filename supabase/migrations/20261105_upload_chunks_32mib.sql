-- Trozos de subida de hasta 32 MiB (antes 16): menos viajes y menos trámites por gigabyte.
ALTER TABLE gma_media_upload_chunks DROP CONSTRAINT gma_media_upload_chunks_check;
ALTER TABLE gma_media_upload_chunks ADD CONSTRAINT gma_media_upload_chunks_check CHECK (start_byte >= 0 AND end_byte >= start_byte AND end_byte - start_byte + 1 <= 33554432);
CREATE OR REPLACE FUNCTION public.gma_media_transfer_commit(p_owner uuid, p_session_id uuid, p_generation integer, p_writer text, p_fence bigint, p_start_byte bigint, p_end_byte bigint, p_sha256 text, p_storage_relative text, p_upstream_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   OR p_end_byte-p_start_byte+1>33554432 OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$'
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
END $function$
;
