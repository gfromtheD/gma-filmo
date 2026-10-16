-- Bound bearer grants: preserve the signed capability contract while separating public and owner ACL.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gma_media_gateway_grants (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 asset_id uuid NOT NULL REFERENCES public.gma_media_assets(id) ON DELETE CASCADE,
 generation integer NOT NULL CHECK(generation>=1), owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 draft_id uuid REFERENCES public.gma_upload_drafts(id) ON DELETE CASCADE,title_slug text,
 audience text NOT NULL CHECK(audience IN ('owner-preview','public-title','owner-title','profile-avatar')),
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((audience='owner-preview' AND owner_id IS NOT NULL AND draft_id IS NOT NULL AND title_slug IS NULL)
 OR (audience='public-title' AND owner_id IS NULL AND draft_id IS NULL AND title_slug IS NOT NULL)
 OR (audience='owner-title' AND owner_id IS NOT NULL AND draft_id IS NULL AND title_slug IS NOT NULL)
 OR (audience='profile-avatar' AND owner_id IS NULL AND draft_id IS NULL AND title_slug IS NULL))
);
CREATE INDEX IF NOT EXISTS gma_media_gateway_grants_expiry ON public.gma_media_gateway_grants(expires_at);
ALTER TABLE public.gma_media_gateway_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gma_media_gateway_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.gma_media_gateway_grants TO service_role;
CREATE OR REPLACE FUNCTION public.gma_media_gateway_grant(p_owner uuid,p_asset_id uuid,p_generation integer,p_draft_id uuid,p_title_slug text,p_token_hash text,p_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a gma_media_assets; p peliculas; grant_audience text; stored_owner uuid; resolved_slug text=p_title_slug; resolved_draft uuid=p_draft_id;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_expires_at<=now() OR p_expires_at>now()+interval '330 seconds' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 SELECT * INTO a FROM gma_media_assets WHERE id=p_asset_id AND state='ready' AND processing_generation=p_generation;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 PERFORM gma_media_authorize(a.id,p_owner,p_title_slug);
 IF resolved_slug IS NULL AND NOT EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id
  WHERE dm.asset_id=a.id AND d.id=resolved_draft AND d.owner_id=p_owner AND d.state='draft') THEN
  SELECT title.slug INTO resolved_slug FROM gma_title_media tm JOIN peliculas title ON title.id=tm.title_id
  WHERE tm.asset_id=a.id AND title.media_delete_state='none' AND (title.status='published' OR (title.status='unpublished' AND title.creator_user_id=p_owner))
  ORDER BY title.id LIMIT 1;resolved_draft=NULL;
 END IF;
 IF resolved_slug IS NOT NULL THEN
  SELECT * INTO p FROM peliculas WHERE slug=resolved_slug AND media_delete_state='none';
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  IF p.status='published' THEN grant_audience='public-title';stored_owner=NULL;
  ELSIF p.status='unpublished' AND p.creator_user_id=p_owner AND a.owner_id=p_owner THEN grant_audience='owner-title';stored_owner=p_owner;
  ELSE RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  IF resolved_draft IS NOT NULL THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
 ELSIF a.role='avatar' AND EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id=a.owner_id AND cp.avatar_url=a.delivery_path) THEN
  grant_audience='profile-avatar';stored_owner=NULL;resolved_draft=NULL;
 ELSE
  IF p_owner IS NULL OR a.owner_id<>p_owner OR NOT EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id
    WHERE dm.asset_id=a.id AND d.id=resolved_draft AND d.owner_id=p_owner AND d.state='draft') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
  grant_audience='owner-preview';stored_owner=p_owner;
 END IF;
 DELETE FROM gma_media_gateway_grants WHERE expires_at<=now();
 INSERT INTO gma_media_gateway_grants(token_hash,asset_id,generation,owner_id,draft_id,title_slug,audience,expires_at)
 VALUES(p_token_hash,a.id,p_generation,stored_owner,resolved_draft,resolved_slug,grant_audience,p_expires_at) ON CONFLICT(token_hash) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM gma_media_gateway_grants g WHERE g.token_hash=p_token_hash AND g.asset_id=a.id AND g.generation=p_generation
  AND g.owner_id IS NOT DISTINCT FROM stored_owner AND g.draft_id IS NOT DISTINCT FROM resolved_draft
  AND g.title_slug IS NOT DISTINCT FROM resolved_slug AND g.audience=grant_audience AND g.expires_at=p_expires_at) THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.gma_media_gateway_output(p_asset_id uuid,p_generation integer,p_relative text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g gma_media_gateway_grants; a gma_media_assets; output jsonb;
BEGIN
 SELECT * INTO g FROM gma_media_gateway_grants WHERE token_hash=p_token_hash AND asset_id=p_asset_id AND generation=p_generation AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 SELECT * INTO a FROM gma_media_assets WHERE id=g.asset_id AND processing_generation=p_generation AND state='ready';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=a.owner_id) THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 IF g.audience='owner-preview' THEN
  IF NOT EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id
   WHERE dm.asset_id=a.id AND d.id=g.draft_id AND d.owner_id=g.owner_id AND d.state='draft') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 ELSIF g.audience='public-title' THEN
  IF NOT EXISTS(SELECT 1 FROM peliculas p WHERE p.slug=g.title_slug AND p.status='published' AND p.media_delete_state='none') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 ELSIF g.audience='profile-avatar' THEN
  IF a.role<>'avatar' OR NOT EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id=a.owner_id AND cp.avatar_url=a.delivery_path) THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM peliculas p WHERE p.slug=g.title_slug AND p.creator_user_id=g.owner_id AND p.status='unpublished' AND p.media_delete_state='none') THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 END IF;
 output=gma_media_output_authorized(a.id,p_relative,g.owner_id,g.title_slug);
 RETURN output||jsonb_build_object('provider',a.provider);
END $$;
REVOKE ALL ON FUNCTION public.gma_media_gateway_grant(uuid,uuid,integer,uuid,text,text,timestamptz),public.gma_media_gateway_output(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gma_media_gateway_grant(uuid,uuid,integer,uuid,text,text,timestamptz),public.gma_media_gateway_output(uuid,integer,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
