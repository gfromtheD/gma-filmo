-- Additive provider-neutral columns and constraints. Historical media rows remain readable.
BEGIN;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(required.name, ', ' ORDER BY required.name) INTO missing
  FROM (VALUES
    ('gma_media_assets','provider'), ('gma_media_assets','state'), ('gma_media_assets','owner_id'),
    ('gma_upload_sessions','provider'), ('gma_upload_sessions','state'), ('gma_upload_sessions','transfer_generation'),
    ('peliculas','playback_kind'), ('peliculas','id'), ('gma_title_media','title_id'), ('gma_title_media','role')
  ) AS required(table_name, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=required.table_name AND c.column_name=required.name
  );
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'MEDIA_PROVIDER_PREFLIGHT: missing columns %', missing; END IF;
  IF EXISTS (SELECT 1 FROM gma_media_assets WHERE provider IS NULL OR provider NOT IN ('r2','stream','mock','peertube'))
     OR EXISTS (SELECT 1 FROM gma_upload_sessions WHERE provider IS NULL OR provider NOT IN ('r2','stream','mock','peertube')) THEN
    RAISE EXCEPTION 'MEDIA_PROVIDER_PREFLIGHT: unexpected existing provider value';
  END IF;
END $$;

ALTER TABLE public.gma_media_assets DROP CONSTRAINT IF EXISTS gma_media_assets_provider_check;
ALTER TABLE public.gma_media_assets ADD CONSTRAINT gma_media_assets_provider_check CHECK(provider IN ('r2','stream','mock','peertube'));
ALTER TABLE public.gma_media_assets DROP CONSTRAINT IF EXISTS gma_media_assets_state_check;
ALTER TABLE public.gma_media_assets ADD CONSTRAINT gma_media_assets_state_check
  CHECK(state IN ('received','validating','processing','ready','failed','rejected','deleting','deleted'));

ALTER TABLE public.gma_upload_sessions DROP CONSTRAINT IF EXISTS gma_upload_sessions_provider_check;
ALTER TABLE public.gma_upload_sessions ADD CONSTRAINT gma_upload_sessions_provider_check CHECK(provider IN ('r2','stream','mock','peertube'));

ALTER TABLE public.gma_media_assets ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE public.gma_media_assets ADD COLUMN IF NOT EXISTS processing_generation integer NOT NULL DEFAULT 1 CHECK(processing_generation>=1);
ALTER TABLE public.gma_media_assets ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.gma_media_assets ADD COLUMN IF NOT EXISTS error_retryable boolean NOT NULL DEFAULT false;
ALTER TABLE public.gma_media_assets ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.gma_upload_sessions ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count>=0);
ALTER TABLE public.gma_upload_sessions ADD COLUMN IF NOT EXISTS last_error_code text;
ALTER TABLE public.gma_upload_sessions ADD COLUMN IF NOT EXISTS transfer_lease_owner text;
ALTER TABLE public.gma_upload_sessions ADD COLUMN IF NOT EXISTS transfer_lease_until timestamptz;
ALTER TABLE public.gma_upload_sessions ADD COLUMN IF NOT EXISTS transfer_fence bigint NOT NULL DEFAULT 0 CHECK(transfer_fence>=0);

ALTER TABLE public.peliculas ADD COLUMN IF NOT EXISTS media_delete_state text NOT NULL DEFAULT 'none';
ALTER TABLE public.peliculas DROP CONSTRAINT IF EXISTS peliculas_media_delete_state_check;
ALTER TABLE public.peliculas ADD CONSTRAINT peliculas_media_delete_state_check CHECK(media_delete_state IN ('none','pending','done'));

CREATE INDEX IF NOT EXISTS gma_media_assets_owner_state_updated ON public.gma_media_assets(owner_id,state,updated_at);
CREATE INDEX IF NOT EXISTS gma_upload_sessions_provider_updated_live ON public.gma_upload_sessions(provider,updated_at)
  WHERE state IN ('provisioning','uploading','paused','uploaded','cancelling');
CREATE INDEX IF NOT EXISTS gma_title_media_title_role ON public.gma_title_media(title_id,role);

-- Provider references and transfer proofs must only be readable by trusted server code.
DROP POLICY IF EXISTS owner_read ON public.gma_media_assets;
DROP POLICY IF EXISTS owner_read ON public.gma_upload_sessions;
REVOKE ALL ON public.gma_media_assets, public.gma_upload_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gma_media_assets, public.gma_upload_sessions TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
