-- Indexed playback authorization and owner row visibility; private provider records stay closed.
BEGIN;
DO $$ DECLARE missing text; BEGIN
 SELECT string_agg(x.table_name||'.'||x.column_name, ', ') INTO missing
 FROM (VALUES ('gma_media_assets','processing_generation'),('gma_media_assets','state'),('gma_title_media','asset_id'),
   ('gma_title_media','title_id'),('gma_media_outputs','asset_id'),('gma_media_outputs','relative'),('peliculas','creator_user_id')) x(table_name,column_name)
 WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=x.table_name AND c.column_name=x.column_name);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MEDIA_DELIVERY_PREFLIGHT: missing %',missing; END IF;
END $$;

ALTER TABLE public.gma_media_outputs ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.gma_media_outputs ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE public.gma_media_outputs DROP CONSTRAINT IF EXISTS gma_media_outputs_size_bytes_check;
ALTER TABLE public.gma_media_outputs ADD CONSTRAINT gma_media_outputs_size_bytes_check CHECK(size_bytes IS NULL OR size_bytes>=0);

-- Backfill only outputs from existing READY R2 metadata; stored object paths are unchanged.
UPDATE public.gma_media_outputs o SET
 mime_type=COALESCE(o.mime_type,a.metadata->'outputs'->(SELECT index::int-1 FROM jsonb_array_elements(a.metadata->'outputs') WITH ORDINALITY e(item,index) WHERE item->>'relative'=o.relative LIMIT 1)->>'mime',
   a.metadata->'outputs'->(SELECT index::int-1 FROM jsonb_array_elements(a.metadata->'outputs') WITH ORDINALITY e(item,index) WHERE item->>'relative'=o.relative LIMIT 1)->>'mime_type'),
 size_bytes=COALESCE(o.size_bytes,(a.metadata->'outputs'->(SELECT index::int-1 FROM jsonb_array_elements(a.metadata->'outputs') WITH ORDINALITY e(item,index) WHERE item->>'relative'=o.relative LIMIT 1)->>'bytes')::bigint,
   (a.metadata->'outputs'->(SELECT index::int-1 FROM jsonb_array_elements(a.metadata->'outputs') WITH ORDINALITY e(item,index) WHERE item->>'relative'=o.relative LIMIT 1)->>'size_bytes')::bigint)
FROM public.gma_media_assets a WHERE a.id=o.asset_id AND a.provider='r2' AND a.state='ready';

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
   IF NEW.provider='mock' AND (bytes IS NULL OR bytes<=0 OR mime NOT IN ('application/vnd.apple.mpegurl','application/x-mpegURL','video/mp2t','video/mp4','image/webp','text/vtt'))
     THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF NEW.provider='r2' AND ((bytes IS NOT NULL AND bytes<0) OR (mime IS NOT NULL AND length(mime)>127)) THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   INSERT INTO gma_media_outputs(asset_id,relative,object_key,mime_type,size_bytes)
     VALUES(NEW.id,rel,prefix||rel,mime,bytes);
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gma_media_outputs_sync ON public.gma_media_assets;
CREATE TRIGGER gma_media_outputs_sync AFTER INSERT OR UPDATE OF state,metadata,processing_generation ON public.gma_media_assets
 FOR EACH ROW EXECUTE FUNCTION public.gma_media_outputs_sync();

CREATE OR REPLACE FUNCTION public.gma_media_authorize(p_asset_id uuid,p_owner uuid,p_title_slug text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('id',a.id,'owner_id',a.owner_id,'provider',a.provider,'role',a.role,'state',a.state,
   'duration_seconds',a.duration_seconds,'expected_input_bytes',a.expected_input_bytes,'received_bytes',a.received_bytes,
   'delivery_path',a.delivery_path,'verified_at',a.verified_at,
   'metadata',jsonb_strip_nulls(jsonb_build_object('width',a.metadata->'width','height',a.metadata->'height','syntheticPlayback',a.metadata->'syntheticPlayback')))
 INTO result FROM gma_media_assets a
 WHERE a.id=p_asset_id AND a.state='ready'
 AND (
   (p_owner IS NOT NULL AND a.owner_id=p_owner AND (
     EXISTS(SELECT 1 FROM gma_draft_media dm JOIN gma_upload_drafts d ON d.id=dm.draft_id
       WHERE dm.asset_id=a.id AND dm.owner_id=p_owner AND d.owner_id=p_owner AND d.state='draft')
     OR EXISTS(SELECT 1 FROM gma_title_media tm JOIN peliculas p ON p.id=tm.title_id
       WHERE tm.asset_id=a.id AND tm.owner_id=p_owner AND p.creator_user_id=p_owner AND p.media_delete_state='none'
         AND p.status IN ('published','unpublished') AND (p_title_slug IS NULL OR p.slug=p_title_slug))
   ))
   OR EXISTS(SELECT 1 FROM gma_title_media tm JOIN peliculas p ON p.id=tm.title_id
      WHERE tm.asset_id=a.id AND tm.owner_id=a.owner_id AND p.creator_user_id=a.owner_id AND p.media_delete_state='none'
        AND (p.status='published' OR (p.status IS NULL AND p.playback_kind='legacy' AND a.provider IN ('r2','stream')))
        AND (p_title_slug IS NULL OR p.slug=p_title_slug))
   OR (a.role='avatar' AND EXISTS(SELECT 1 FROM creator_profiles cp WHERE cp.user_id=a.owner_id AND cp.avatar_url=a.delivery_path))
 );
 IF result IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.gma_media_output_authorized(p_asset_id uuid,p_relative text,p_owner uuid,p_title_slug text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE summary jsonb; result jsonb;
BEGIN
 summary=gma_media_authorize(p_asset_id,p_owner,p_title_slug);
 SELECT jsonb_build_object('asset',summary,'key',o.object_key,'mimeType',o.mime_type,'sizeBytes',o.size_bytes) INTO result
 FROM gma_media_outputs o WHERE o.asset_id=p_asset_id AND o.relative=p_relative;
 IF result IS NULL THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.gma_video_output_authorized(p_asset_id uuid,p_relative text,p_owner uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('asset',gma_media_authorize(p_asset_id,p_owner,NULL),'key',o.object_key)
 FROM gma_media_outputs o WHERE o.asset_id=p_asset_id AND o.relative=p_relative;
$$;

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['gma_upload_drafts','gma_upload_sessions','gma_media_assets','gma_draft_media','gma_title_media'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('DROP POLICY IF EXISTS owner_read ON public.%I',t);
   EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (owner_id=auth.uid())',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['gma_media_provider_private','gma_media_command_results','gma_media_upload_chunks','gma_title_media_versions','gma_media_outputs','gma_upload_jobs','gma_upload_quota','gma_upload_ledger','gma_upload_inbox','gma_upload_publications','gma_upload_account_deletions','gma_processing_attempts'] LOOP
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('gma_media_authorize','gma_media_output_authorized','gma_video_output_authorized','gma_media_outputs_sync') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
