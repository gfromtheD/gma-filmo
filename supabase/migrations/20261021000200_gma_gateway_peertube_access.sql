-- Autorización de entrega HLS de PeerTube a través de la pasarela GMA (VPS).
-- Aditiva. Mismas reglas de audiencia que gma_media_gateway_output (0007), pero para activos de PeerTube, cuyo inventario
-- de segmentos vive en PeerTube y no en gma_media_outputs. Devuelve solo lo que la pasarela necesita para pedir el vídeo.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.gma_media_gateway_grants') IS NULL THEN
    RAISE EXCEPTION 'GMA_GATEWAY_PEERTUBE_PREFLIGHT: aplicar antes 202610080007_media_gateway_grants';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_gateway_peertube_access(p_asset_id uuid, p_generation integer, p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g gma_media_gateway_grants; a gma_media_assets;
BEGIN
  SELECT * INTO g FROM gma_media_gateway_grants WHERE token_hash = p_token_hash AND asset_id = p_asset_id AND generation = p_generation AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  SELECT * INTO a FROM gma_media_assets WHERE id = g.asset_id AND processing_generation = p_generation AND state = 'ready' AND provider = 'peertube';
  IF NOT FOUND OR a.provider_ref IS NULL OR EXISTS (SELECT 1 FROM gma_upload_account_deletions WHERE owner_id = a.owner_id) THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  IF g.audience = 'owner-preview' THEN
    IF NOT EXISTS (SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id = dm.draft_id
      WHERE dm.asset_id = a.id AND d.id = g.draft_id AND d.owner_id = g.owner_id AND d.state = 'draft') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  ELSIF g.audience = 'public-title' THEN
    IF NOT EXISTS (SELECT 1 FROM peliculas p WHERE p.slug = g.title_slug AND p.status = 'published' AND p.media_delete_state = 'none') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  ELSIF g.audience = 'profile-avatar' THEN
    RAISE EXCEPTION 'UPLOAD_NOT_FOUND';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM peliculas p WHERE p.slug = g.title_slug AND p.creator_user_id = g.owner_id AND p.status = 'unpublished' AND p.media_delete_state = 'none') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  END IF;
  RETURN jsonb_build_object('provider', a.provider, 'provider_ref', a.provider_ref, 'expected_input_bytes', a.expected_input_bytes);
END $$;

REVOKE ALL ON FUNCTION public.gma_media_gateway_peertube_access(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_gateway_peertube_access(uuid, integer, text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
