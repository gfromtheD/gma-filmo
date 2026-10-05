-- Additive migration. Run preflight against the effective schema first.
-- Does not replay seeds, truncate legacy content or publish existing objects.
BEGIN;
DO $$
DECLARE missing text; id_type text;
BEGIN
  SELECT string_agg(c, ', ') INTO missing FROM unnest(ARRAY[
    'id','slug','title','synopsis','year','duration','author','r2_video_url',
    'r2_poster_url','r2_subtitle_url','creator_user_id','genre','language','file_size_bytes','status','source_page'
  ]) c WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='peliculas' AND column_name=c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: peliculas missing %', missing; END IF;
  SELECT udt_name INTO id_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='peliculas' AND column_name='id';
  IF id_type NOT IN ('int2','int4','int8') THEN RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: unsupported title id'; END IF;
  IF to_regclass('public.creator_profiles') IS NULL OR to_regclass('auth.users') IS NULL
    THEN RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: auth/creator tables required'; END IF;
  SELECT string_agg(c,', ') INTO missing FROM unnest(ARRAY['user_id','creator_name','avatar_url']) c WHERE NOT EXISTS
    (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='creator_profiles' AND column_name=c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: creator_profiles missing %',missing; END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='peliculas' AND
    ((column_name='creator_user_id' AND udt_name<>'uuid') OR (column_name IN ('year','duration','status','source_page') AND udt_name NOT IN ('text','varchar','bpchar'))))
    THEN RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: unsupported catalog types'; END IF;
  IF to_regclass('public.colecciones') IS NULL OR to_regclass('public.peliculas_colecciones') IS NULL THEN
    RAISE EXCEPTION 'UPLOAD_SCHEMA_PREFLIGHT: collection relations required'; END IF;
END; $$;

ALTER TABLE public.peliculas ADD COLUMN IF NOT EXISTS stream_uid text;
ALTER TABLE public.peliculas ADD COLUMN IF NOT EXISTS playback_kind text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.peliculas ADD COLUMN IF NOT EXISTS media_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.peliculas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gma_title_visibility ON public.peliculas;
CREATE POLICY gma_title_visibility ON public.peliculas AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING (status IS NULL OR status='published' OR creator_user_id=auth.uid());
-- Existing permissive read policies remain intact; this adds the publication boundary.
CREATE TABLE IF NOT EXISTS public.gma_upload_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  user_bytes bigint NOT NULL DEFAULT 10737418240 CHECK(user_bytes>0),
  draft_bytes bigint NOT NULL DEFAULT 6442450944 CHECK(draft_bytes>0),
  global_bytes bigint NOT NULL DEFAULT 107374182400 CHECK(global_bytes>0),
  global_stream_seconds bigint NOT NULL DEFAULT 60000 CHECK(global_stream_seconds>0),
  user_stream_seconds bigint NOT NULL DEFAULT 36000 CHECK(user_stream_seconds>0),
  legacy_inventory_verified boolean NOT NULL DEFAULT false,
  user_active_sessions integer NOT NULL DEFAULT 3 CHECK(user_active_sessions>0)
);
INSERT INTO public.gma_upload_policy(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.gma_upload_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK(purpose IN ('title','avatar')),
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','abandoned')),
  metadata jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0,
  title_id bigint REFERENCES public.peliculas(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,owner_id)
);
CREATE TABLE IF NOT EXISTS public.gma_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK(role IN ('main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar')),
  provider text NOT NULL CHECK(provider IN ('stream','r2')),
  provider_ref text, state text NOT NULL DEFAULT 'received'
    CHECK(state IN ('received','validating','processing','ready','rejected','deleting','deleted')),
  expected_input_bytes bigint NOT NULL CHECK(expected_input_bytes>0),
  received_bytes bigint CHECK(received_bytes>=0), provider_reported_size bigint CHECK(provider_reported_size>=0),
  duration_seconds double precision CHECK(duration_seconds>=0),
  metadata jsonb NOT NULL DEFAULT '{}', delivery_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,owner_id), UNIQUE(provider,provider_ref)
);
CREATE TABLE IF NOT EXISTS public.gma_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  draft_id uuid NOT NULL, asset_id uuid NOT NULL,
  role text NOT NULL, slot text NOT NULL, language text,
  provider text NOT NULL CHECK(provider IN ('stream','r2')), provider_ref text,
  provider_data jsonb NOT NULL DEFAULT '{}',
  expected_input_bytes bigint NOT NULL CHECK(expected_input_bytes>0),
  source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
  content_type text NOT NULL, file_name text NOT NULL,
  max_duration_seconds integer NOT NULL CHECK(max_duration_seconds>=0),
  state text NOT NULL DEFAULT 'provisioning'
    CHECK(state IN ('provisioning','uploading','paused','uploaded','cancelling','cancelled','expired','failed')),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
  revision integer NOT NULL DEFAULT 0, quota_confirmed boolean NOT NULL DEFAULT false,
  quota_released boolean NOT NULL DEFAULT false, idempotency_key text NOT NULL, request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(draft_id,owner_id) REFERENCES public.gma_upload_drafts(id,owner_id),
  FOREIGN KEY(asset_id,owner_id) REFERENCES public.gma_media_assets(id,owner_id),
  UNIQUE(owner_id,idempotency_key), UNIQUE(asset_id), UNIQUE(provider,provider_ref)
);
CREATE TABLE IF NOT EXISTS public.gma_draft_media (
  draft_id uuid NOT NULL, owner_id uuid NOT NULL, asset_id uuid NOT NULL, role text NOT NULL,
  slot text NOT NULL, language text, position integer NOT NULL DEFAULT 0 CHECK(position>=0),
  PRIMARY KEY(draft_id,slot),
  FOREIGN KEY(draft_id,owner_id) REFERENCES public.gma_upload_drafts(id,owner_id),
  FOREIGN KEY(asset_id,owner_id) REFERENCES public.gma_media_assets(id,owner_id)
);
CREATE TABLE IF NOT EXISTS public.gma_title_media (
  title_id bigint NOT NULL REFERENCES public.peliculas(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL, owner_id uuid NOT NULL, role text NOT NULL,
  slot text NOT NULL, language text, position integer NOT NULL DEFAULT 0,
  PRIMARY KEY(title_id,slot),
  FOREIGN KEY(asset_id,owner_id) REFERENCES public.gma_media_assets(id,owner_id)
);
CREATE TABLE IF NOT EXISTS public.gma_upload_quota (
  account_key text PRIMARY KEY, used_bytes bigint NOT NULL DEFAULT 0 CHECK(used_bytes>=0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  used_seconds bigint NOT NULL DEFAULT 0 CHECK(used_seconds>=0),
  reserved_seconds bigint NOT NULL DEFAULT 0 CHECK(reserved_seconds>=0)
);
CREATE TABLE IF NOT EXISTS public.gma_upload_ledger (
  session_id uuid NOT NULL REFERENCES public.gma_upload_sessions(id),
  account_key text NOT NULL REFERENCES public.gma_upload_quota(account_key),
  event text NOT NULL CHECK(event IN ('reserve','confirm','release')),
  bytes bigint NOT NULL, seconds bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,account_key,event)
);
CREATE TABLE IF NOT EXISTS public.gma_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid REFERENCES public.gma_upload_sessions(id),
  kind text NOT NULL CHECK(kind IN ('provision','verify','delete','reconcile')),
  payload jsonb NOT NULL DEFAULT '{}', dedupe_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','done','dead')),
  attempts integer NOT NULL DEFAULT 0, run_after timestamptz NOT NULL DEFAULT now(),
  lease_owner text, lease_until timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gma_jobs_due ON public.gma_upload_jobs(run_after) WHERE state IN ('pending','running');
CREATE INDEX IF NOT EXISTS gma_sessions_reconcile ON public.gma_upload_sessions(updated_at,state);
CREATE TABLE IF NOT EXISTS public.gma_upload_inbox (
  digest text PRIMARY KEY, provider_uid text NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gma_upload_publications (
  draft_id uuid PRIMARY KEY REFERENCES public.gma_upload_drafts(id), request_hash text NOT NULL,
  title_id bigint NOT NULL REFERENCES public.peliculas(id), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gma_upload_account_deletions (
 owner_id uuid PRIMARY KEY, state text NOT NULL DEFAULT 'cleanup' CHECK(state IN ('cleanup','purged','done')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.gma_upload_enqueue_job(p_kind text,p_session_id uuid,p_payload jsonb,p_dedupe_key text,p_run_after timestamptz)
RETURNS public.gma_upload_jobs LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO gma_upload_jobs(kind,session_id,payload,dedupe_key,run_after)
  VALUES(p_kind,p_session_id,p_payload,p_dedupe_key,p_run_after)
  ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=excluded.dedupe_key RETURNING *;
$$;
CREATE OR REPLACE FUNCTION public.gma_upload_claim_session_job(p_session_id uuid,p_kind text,p_worker text,p_lease_seconds integer)
RETURNS public.gma_upload_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j gma_upload_jobs;
BEGIN
 SELECT * INTO j FROM gma_upload_jobs
 WHERE (p_session_id IS NULL OR session_id=p_session_id) AND (p_kind IS NULL OR kind=p_kind)
 AND ((state='pending' AND run_after<=now()) OR (state='running' AND lease_until<now()))
 ORDER BY run_after,id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE gma_upload_jobs SET state='running',attempts=attempts+1,lease_owner=p_worker,
 lease_until=now()+make_interval(secs=>LEAST(300,GREATEST(30,p_lease_seconds))),updated_at=now()
 WHERE id=j.id RETURNING * INTO j; RETURN j;
END; $$;
CREATE OR REPLACE FUNCTION public.gma_upload_finish_job(p_job_id uuid,p_worker text,p_success boolean,p_error text,p_retry_after timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE gma_upload_jobs SET state=CASE WHEN p_success THEN 'done' WHEN attempts>=12 THEN 'dead' ELSE 'pending' END,
 last_error=left(p_error,100),run_after=COALESCE(p_retry_after,now()+interval '1 minute'),
 lease_owner=NULL,lease_until=NULL,updated_at=now()
 WHERE id=p_job_id AND state='running' AND lease_owner=p_worker AND lease_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF; RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.gma_upload_command(p_owner uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d gma_upload_drafts; s gma_upload_sessions; a gma_media_assets; q gma_upload_quota;
 pol gma_upload_policy; r text; b bigint; sec integer; cap bigint; slot_name text;
 sid uuid; aid uuid; k text; keys text[]; actual_sec bigint; result jsonb; film peliculas; old_asset uuid;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
 -- All quota writers acquire a global lock before owner/draft rows, in one order.
 INSERT INTO gma_upload_quota(account_key) VALUES('global') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM gma_upload_quota WHERE account_key='global' FOR UPDATE;
 SELECT * INTO pol FROM gma_upload_policy WHERE id=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_POLICY_UNAVAILABLE'; END IF;
 IF p_action='edit_title' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   IF film.media_revision<>COALESCE((p_payload->>'revision')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   IF length(COALESCE(trim(p_payload->'metadata'->>'title'),'')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE peliculas SET title=p_payload->'metadata'->>'title',synopsis=p_payload->'metadata'->>'synopsis',year=p_payload->'metadata'->>'year',
     language=COALESCE(p_payload->'metadata'->>'language',language),media_revision=media_revision+1 WHERE id=film.id RETURNING * INTO film;
   IF p_payload->'metadata'->>'genre' IS NOT NULL THEN
     DELETE FROM peliculas_colecciones WHERE pelicula_id=film.id AND coleccion_id IN (SELECT id FROM colecciones WHERE slug IN
       ('drama','thriller','documental','experimental','comedia','terror','ciencia-ficcion','romance','animacion'));
     INSERT INTO peliculas_colecciones(pelicula_id,coleccion_id) SELECT film.id,id FROM colecciones WHERE slug=(CASE p_payload->'metadata'->>'genre' WHEN 'Drama' THEN 'drama' WHEN 'Thriller' THEN 'thriller' WHEN 'Documental' THEN 'documental' WHEN 'Experimental' THEN 'experimental' WHEN 'Comedia' THEN 'comedia' WHEN 'Terror' THEN 'terror' WHEN 'Ciencia ficción' THEN 'ciencia-ficcion' WHEN 'Romance' THEN 'romance' WHEN 'Animación' THEN 'animacion' END);
   END IF;
   RETURN to_jsonb(film);
 END IF;
 IF p_action='delete_account' THEN
   INSERT INTO gma_upload_account_deletions(owner_id) VALUES(p_owner) ON CONFLICT DO NOTHING;
   UPDATE peliculas SET status='unpublished' WHERE creator_user_id=p_owner;
   DELETE FROM gma_title_media WHERE owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=NULL WHERE user_id=p_owner;
   FOR s IN SELECT * FROM gma_upload_sessions WHERE owner_id=p_owner AND NOT quota_released LOOP
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END LOOP;
   RETURN jsonb_build_object('pending',true);
 END IF;
 IF p_action='purge_account' THEN
   IF NOT EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner AND state='cleanup')
     OR EXISTS(SELECT 1 FROM gma_upload_sessions WHERE owner_id=p_owner AND NOT quota_released)
     THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   DELETE FROM gma_upload_jobs WHERE session_id IN (SELECT id FROM gma_upload_sessions WHERE owner_id=p_owner);
   DELETE FROM gma_upload_ledger WHERE session_id IN (SELECT id FROM gma_upload_sessions WHERE owner_id=p_owner);
   DELETE FROM gma_draft_media WHERE owner_id=p_owner;
   DELETE FROM gma_upload_sessions WHERE owner_id=p_owner;
   DELETE FROM gma_upload_publications WHERE draft_id IN (SELECT id FROM gma_upload_drafts WHERE owner_id=p_owner);
   DELETE FROM gma_upload_drafts WHERE owner_id=p_owner;
   DELETE FROM gma_media_assets WHERE owner_id=p_owner;
   UPDATE gma_upload_account_deletions SET state='purged' WHERE owner_id=p_owner;
   RETURN jsonb_build_object('pending',true);
 END IF;
 IF EXISTS(SELECT 1 FROM gma_upload_account_deletions WHERE owner_id=p_owner) AND p_action NOT IN
   ('intent','bind','receipt','observe','cancel','delete_confirmed') THEN RAISE EXCEPTION 'UPLOAD_ACCOUNT_DELETING'; END IF;
 IF p_action='retire' THEN
   SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'slug' AND creator_user_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE peliculas SET status='unpublished',media_revision=media_revision+1 WHERE id=film.id;
   UPDATE gma_upload_drafts SET state='abandoned' WHERE title_id=film.id AND state='draft';
   DELETE FROM gma_title_media WHERE title_id=film.id;
   FOR s IN SELECT us.* FROM gma_upload_sessions us JOIN gma_upload_drafts dr ON dr.id=us.draft_id
     WHERE dr.title_id=film.id AND NOT us.quota_released LOOP
     IF NOT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) THEN
       PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
     END IF;
   END LOOP;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='create_draft' THEN
   IF p_payload->>'purpose'='title' AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner)
     THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   IF (SELECT count(*) FROM gma_upload_drafts WHERE owner_id=p_owner AND state='draft')>=20 THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
   INSERT INTO gma_upload_drafts(owner_id,purpose) VALUES(p_owner,p_payload->>'purpose') RETURNING * INTO d;
   IF p_payload->>'title_slug' IS NOT NULL THEN
     SELECT * INTO film FROM peliculas WHERE slug=p_payload->>'title_slug' AND creator_user_id=p_owner;
     IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
     UPDATE gma_upload_drafts SET title_id=film.id,metadata=jsonb_build_object('title',film.title,'synopsis',film.synopsis,
       'year',film.year,'language',film.language,'base_title_revision',film.media_revision) WHERE id=d.id RETURNING * INTO d;
   END IF;
   RETURN to_jsonb(d);
 END IF;
 IF p_action IN ('intent','bind','receipt','observe','cancel','pause','delete_confirmed','label_subtitle') THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE id=(p_payload->>'session_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   SELECT * INTO d FROM gma_upload_drafts WHERE id=s.draft_id FOR UPDATE;
   SELECT * INTO a FROM gma_media_assets WHERE id=s.asset_id FOR UPDATE;
 ELSE
   SELECT * INTO d FROM gma_upload_drafts WHERE id=(p_payload->>'draft_id')::uuid AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
 END IF;
 IF p_action='publish' AND EXISTS(SELECT 1 FROM gma_upload_publications WHERE draft_id=d.id) THEN
   IF NOT EXISTS(SELECT 1 FROM gma_upload_publications WHERE draft_id=d.id AND request_hash=p_payload->>'request_hash')
     THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
   SELECT * INTO film FROM peliculas WHERE id=(SELECT title_id FROM gma_upload_publications WHERE draft_id=d.id);
   RETURN to_jsonb(film);
 END IF;
 IF p_action IN ('update_draft','reserve','publish','reorder','label_subtitle') AND d.state<>'draft' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='reserve' THEN
   SELECT * INTO s FROM gma_upload_sessions WHERE owner_id=p_owner AND idempotency_key=p_payload->>'idempotency_key';
   IF FOUND THEN
     IF s.request_hash<>p_payload->>'request_hash' THEN RAISE EXCEPTION 'UPLOAD_IDEMPOTENCY_CONFLICT'; END IF;
     RETURN to_jsonb(s);
   END IF;
 END IF;
 IF p_action IN ('update_draft','reserve','publish','reorder','label_subtitle') AND d.revision<>COALESCE((p_payload->>'revision')::integer,-1)
   THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
 IF p_action='update_draft' THEN
   UPDATE gma_upload_drafts SET metadata=(p_payload->'metadata')||CASE WHEN metadata ? 'base_title_revision' THEN jsonb_build_object('base_title_revision',metadata->'base_title_revision') ELSE '{}'::jsonb END,revision=revision+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
   RETURN to_jsonb(d);
 ELSIF p_action='reserve' THEN
   IF NOT pol.legacy_inventory_verified THEN RAISE EXCEPTION 'UPLOAD_LEGACY_INVENTORY_REQUIRED'; END IF;
   r=p_payload->>'role'; b=(p_payload->>'bytes')::bigint;
   cap=CASE r WHEN 'main' THEN 4294967296 WHEN 'trailer' THEN 1073741824 WHEN 'extras' THEN 1073741824
     WHEN 'intro' THEN 524288000 WHEN 'poster' THEN 10485760 WHEN 'poster_h' THEN 10485760 WHEN 'poster_v' THEN 10485760
     WHEN 'subtitles' THEN 5242880 WHEN 'avatar' THEN 5242880 ELSE 0 END;
   IF b IS NULL OR cap=0 OR b<1 OR b>cap OR COALESCE(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
      OR length(p_payload->>'idempotency_key') NOT BETWEEN 1 AND 120
      OR length(p_payload->>'file_name') NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF (d.purpose='avatar')<>(r='avatar') OR (d.purpose='title' AND NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner))
     THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   sec=CASE r WHEN 'main' THEN 14400 WHEN 'extras' THEN 3600 WHEN 'trailer' THEN 600 WHEN 'intro' THEN 300 ELSE 0 END;
   slot_name=CASE WHEN r='extras' THEN 'extras:'||(p_payload->>'idempotency_key')
     WHEN r='subtitles' THEN 'subtitles:'||COALESCE(NULLIF(p_payload->>'language',''),'und') ELSE r END;
   IF EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND slot=slot_name) THEN RAISE EXCEPTION 'UPLOAD_SLOT_OCCUPIED'; END IF;
   IF (SELECT count(*) FROM gma_upload_sessions WHERE owner_id=p_owner AND state IN ('provisioning','uploading','paused'))>=pol.user_active_sessions
     THEN RAISE EXCEPTION 'UPLOAD_CONCURRENCY_LIMIT'; END IF;
   keys=ARRAY['global','owner:'||p_owner::text,'draft:'||d.id::text];
   FOREACH k IN ARRAY keys LOOP
     INSERT INTO gma_upload_quota(account_key) VALUES(k) ON CONFLICT DO NOTHING;
     SELECT * INTO q FROM gma_upload_quota WHERE account_key=k FOR UPDATE;
     IF q.used_bytes+q.reserved_bytes+b>(CASE WHEN k='global' THEN pol.global_bytes WHEN k LIKE 'owner:%' THEN pol.user_bytes ELSE pol.draft_bytes END)
       OR q.used_seconds+q.reserved_seconds+sec>(CASE WHEN k='global' THEN pol.global_stream_seconds ELSE pol.user_stream_seconds END)
       THEN RAISE EXCEPTION 'UPLOAD_QUOTA_EXCEEDED'; END IF;
   END LOOP;
   INSERT INTO gma_media_assets(owner_id,role,provider,expected_input_bytes)
     VALUES(p_owner,r,CASE WHEN sec>0 THEN 'stream' ELSE 'r2' END,b) RETURNING id INTO aid;
   INSERT INTO gma_upload_sessions(owner_id,draft_id,asset_id,role,slot,language,provider,expected_input_bytes,source_sha256,
     content_type,file_name,max_duration_seconds,idempotency_key,request_hash)
   VALUES(p_owner,d.id,aid,r,slot_name,p_payload->>'language',CASE WHEN sec>0 THEN 'stream' ELSE 'r2' END,b,p_payload->>'sha256',
     left(p_payload->>'content_type',100),p_payload->>'file_name',sec,p_payload->>'idempotency_key',p_payload->>'request_hash') RETURNING * INTO s;
   INSERT INTO gma_draft_media(draft_id,owner_id,asset_id,role,slot,language,position)
     VALUES(d.id,p_owner,aid,r,slot_name,s.language,(SELECT count(*) FROM gma_draft_media WHERE draft_id=d.id));
   FOREACH k IN ARRAY keys LOOP
     UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes+b,reserved_seconds=reserved_seconds+sec WHERE account_key=k;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'reserve',b,sec);
   END LOOP;
   PERFORM gma_upload_enqueue_job('provision',s.id,'{}','provision:'||s.id,now());
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
   RETURN to_jsonb(s);
 ELSIF p_action='intent' THEN
   IF s.state<>'provisioning' OR s.provider_data->>'provision_started'='true' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET provider_data=provider_data||jsonb_build_object('provision_started',true),updated_at=now()
     WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='receipt' THEN
   IF COALESCE((p_payload->>'received_bytes')::bigint,-1)<>s.expected_input_bytes THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   UPDATE gma_upload_sessions SET provider_data=provider_data||jsonb_build_object('received_bytes',s.expected_input_bytes),updated_at=now()
     WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='bind' THEN
   -- Save even a late provisioning response, so cancellation can clean it up.
   IF s.provider_ref IS NOT NULL AND s.provider_ref<>p_payload->>'provider_ref' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET provider_ref=p_payload->>'provider_ref',provider_data=provider_data||COALESCE(p_payload->'provider_data','{}'),
     state=CASE WHEN state='provisioning' THEN 'uploading' ELSE state END,revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   UPDATE gma_media_assets SET provider_ref=s.provider_ref WHERE id=s.asset_id;
   IF s.state='cancelling' THEN PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now()); END IF;
   RETURN to_jsonb(s);
 ELSIF p_action='pause' THEN
   IF s.state NOT IN ('uploading','paused') THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   UPDATE gma_upload_sessions SET state=CASE WHEN p_payload->>'paused'='true' THEN 'paused' ELSE 'uploading' END,
     revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s; RETURN to_jsonb(s);
 ELSIF p_action='cancel' THEN
   IF EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) OR EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner AND avatar_url=a.delivery_path) THEN RAISE EXCEPTION 'UPLOAD_ASSET_IN_USE'; END IF;
   IF s.quota_released OR s.state='cancelling' THEN RETURN to_jsonb(s); END IF;
   DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   UPDATE gma_media_assets SET state='deleting',updated_at=now() WHERE id=s.asset_id;
   UPDATE gma_upload_sessions SET state='cancelling',revision=revision+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id;
   PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now()); RETURN to_jsonb(s);
 ELSIF p_action='observe' THEN
   IF s.state IN ('cancelling','cancelled','expired') OR a.state IN ('deleting','deleted') THEN RETURN to_jsonb(a); END IF;
   IF p_payload->>'state' NOT IN ('processing','ready','rejected') THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF p_payload->>'state'='ready' THEN
     IF COALESCE((p_payload->>'received_bytes')::bigint,-1)<>s.expected_input_bytes OR
       (s.provider='stream' AND (COALESCE((p_payload->>'duration_seconds')::double precision,0)<=0
          OR (p_payload->>'duration_seconds')::double precision>s.max_duration_seconds
          OR COALESCE(p_payload->>'pct_complete','')<>'100' OR COALESCE(p_payload->>'ready_to_stream','')<>'true'))
       THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
     actual_sec=CASE WHEN s.provider='stream' THEN ceil((p_payload->>'duration_seconds')::double precision)::bigint ELSE 0 END;
     IF NOT s.quota_confirmed THEN
       FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
         UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,used_bytes=used_bytes+s.expected_input_bytes,
           reserved_seconds=reserved_seconds-s.max_duration_seconds,used_seconds=used_seconds+actual_sec WHERE account_key=k;
         INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'confirm',s.expected_input_bytes,actual_sec);
       END LOOP;
       UPDATE gma_upload_sessions SET quota_confirmed=true WHERE id=s.id;
     END IF;
   END IF;
   UPDATE gma_media_assets SET state=p_payload->>'state',received_bytes=(p_payload->>'received_bytes')::bigint,
     provider_reported_size=(p_payload->>'provider_reported_size')::bigint,duration_seconds=(p_payload->>'duration_seconds')::double precision,
     metadata=COALESCE(p_payload->'metadata',metadata),delivery_path=COALESCE(p_payload->>'delivery_path',delivery_path),updated_at=now()
     WHERE id=s.asset_id RETURNING * INTO a;
   UPDATE gma_upload_sessions SET state=CASE WHEN (p_payload->>'received_bytes')::bigint=expected_input_bytes THEN 'uploaded' ELSE state END,revision=revision+1,updated_at=now() WHERE id=s.id;
   IF a.state='rejected' THEN
     PERFORM gma_upload_enqueue_job('delete',s.id,'{}','delete:'||s.id,now());
     UPDATE gma_upload_sessions SET state='cancelling' WHERE id=s.id;
     DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   END IF;
   RETURN to_jsonb(a);
 ELSIF p_action='delete_confirmed' THEN
   IF s.quota_released THEN RETURN to_jsonb(s); END IF;
   IF COALESCE(p_payload->>'absent','')<>'true' OR EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) OR EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner AND avatar_url=a.delivery_path)
     OR (now()<s.expires_at AND (s.provider='r2' OR s.provider_ref IS NOT NULL OR s.provider_data->>'provision_started'='true')) THEN RAISE EXCEPTION 'UPLOAD_CLEANUP_UNCONFIRMED'; END IF;
   FOR k IN SELECT account_key FROM gma_upload_ledger WHERE session_id=s.id AND event='reserve' ORDER BY account_key LOOP
     IF s.quota_confirmed THEN
       SELECT seconds INTO actual_sec FROM gma_upload_ledger WHERE session_id=s.id AND account_key=k AND event='confirm';
       UPDATE gma_upload_quota SET used_bytes=used_bytes-s.expected_input_bytes,used_seconds=used_seconds-actual_sec WHERE account_key=k;
     ELSE
       UPDATE gma_upload_quota SET reserved_bytes=reserved_bytes-s.expected_input_bytes,reserved_seconds=reserved_seconds-s.max_duration_seconds WHERE account_key=k;
     END IF;
     INSERT INTO gma_upload_ledger(session_id,account_key,event,bytes,seconds) VALUES(s.id,k,'release',s.expected_input_bytes,COALESCE(actual_sec,s.max_duration_seconds));
   END LOOP;
   UPDATE gma_media_assets SET state='deleted',updated_at=now() WHERE id=s.asset_id;
   DELETE FROM gma_draft_media WHERE asset_id=s.asset_id;
   UPDATE gma_upload_sessions SET state='cancelled',quota_released=true,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   RETURN to_jsonb(s);
 ELSIF p_action='abandon' THEN
   IF d.state<>'draft' THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
   FOR s IN SELECT * FROM gma_upload_sessions WHERE draft_id=d.id AND NOT quota_released LOOP
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END LOOP;
   UPDATE gma_upload_drafts SET state='abandoned',revision=revision+1 WHERE id=d.id RETURNING * INTO d; RETURN to_jsonb(d);
 ELSIF p_action='avatar' THEN
   IF d.purpose<>'avatar' THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   SELECT a1.* INTO a FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.draft_id=d.id AND m.role='avatar';
   IF NOT FOUND OR a.state<>'ready' THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   -- Onboarding may precede creator_profiles; the owner may use delivery_path after ready.
   SELECT us.* INTO s FROM gma_upload_sessions us JOIN gma_media_assets ma ON ma.id=us.asset_id
     JOIN creator_profiles cp ON cp.avatar_url=ma.delivery_path AND cp.user_id=p_owner WHERE us.owner_id=p_owner;
   UPDATE creator_profiles SET avatar_url=a.delivery_path WHERE user_id=p_owner;
   UPDATE gma_upload_drafts SET state='published',revision=revision+1 WHERE id=d.id;
   IF s.id IS NOT NULL AND s.asset_id<>a.id THEN
     PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
   END IF;
   RETURN to_jsonb(a);
 ELSIF p_action='label_subtitle' THEN
   IF s.role<>'subtitles' OR COALESCE(p_payload->>'language','') !~ '^[a-zA-Z0-9-]{2,35}$' THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   slot_name='subtitles:'||(p_payload->>'language');
   IF EXISTS(SELECT 1 FROM gma_draft_media WHERE draft_id=d.id AND slot=slot_name AND asset_id<>s.asset_id) THEN RAISE EXCEPTION 'UPLOAD_SLOT_OCCUPIED'; END IF;
   UPDATE gma_draft_media SET language=p_payload->>'language',slot=slot_name WHERE draft_id=d.id AND asset_id=s.asset_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE gma_upload_sessions SET language=p_payload->>'language',slot=slot_name WHERE id=s.id;
   UPDATE gma_upload_drafts SET revision=revision+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;RETURN to_jsonb(d);
 ELSIF p_action='reorder' THEN
   UPDATE gma_draft_media SET position=(p_payload->>'position')::integer WHERE draft_id=d.id AND asset_id=(p_payload->>'asset_id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_FOUND'; END IF;
   UPDATE gma_upload_drafts SET revision=revision+1 WHERE id=d.id RETURNING * INTO d; RETURN to_jsonb(d);
 ELSIF p_action='publish' THEN
   IF d.purpose<>'title' OR NOT EXISTS(SELECT 1 FROM creator_profiles WHERE user_id=p_owner) THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
   SELECT a1.* INTO a FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.draft_id=d.id AND m.role='main';
   IF NOT FOUND OR a.state<>'ready' OR EXISTS(SELECT 1 FROM gma_draft_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id
     WHERE m.draft_id=d.id AND (a1.state<>'ready' OR a1.owner_id<>p_owner)) THEN RAISE EXCEPTION 'UPLOAD_MEDIA_NOT_READY'; END IF;
   IF length(COALESCE(trim(d.metadata->>'title'),'')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'UPLOAD_INVALID_INPUT'; END IF;
   IF d.title_id IS NULL THEN
     INSERT INTO peliculas(slug,title,synopsis,year,duration,author,creator_user_id,genre,language,file_size_bytes,status,source_page,stream_uid,playback_kind)
     VALUES('gma-'||d.id,trim(d.metadata->>'title'),d.metadata->>'synopsis',d.metadata->>'year',
       floor(a.duration_seconds/60)::text||'m', (SELECT creator_name FROM creator_profiles WHERE user_id=p_owner),p_owner,
       CASE WHEN a.duration_seconds>=2400 THEN 'Película' ELSE 'Cortometraje' END,d.metadata->>'language',
       a.expected_input_bytes,'published','studio_upload',a.provider_ref,'stream') RETURNING * INTO film;
   ELSE
     SELECT * INTO film FROM peliculas WHERE id=d.title_id AND creator_user_id=p_owner FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FORBIDDEN'; END IF;
     IF film.media_revision<>COALESCE((d.metadata->>'base_title_revision')::integer,-1) THEN RAISE EXCEPTION 'UPLOAD_REVISION_CONFLICT'; END IF;
     DELETE FROM gma_title_media WHERE title_id=film.id;
     UPDATE peliculas SET title=trim(d.metadata->>'title'),synopsis=d.metadata->>'synopsis',year=d.metadata->>'year',
       language=d.metadata->>'language',duration=floor(a.duration_seconds/60)::text||'m',stream_uid=a.provider_ref,playback_kind='stream',
       genre=CASE WHEN a.duration_seconds>=2400 THEN 'Película' ELSE 'Cortometraje' END,file_size_bytes=a.expected_input_bytes,status='published',media_revision=media_revision+1
       WHERE id=film.id RETURNING * INTO film;
   END IF;
   IF d.metadata->>'genre' IS NOT NULL THEN
     DELETE FROM peliculas_colecciones WHERE pelicula_id=film.id AND coleccion_id IN (SELECT id FROM colecciones WHERE slug IN
       ('drama','thriller','documental','experimental','comedia','terror','ciencia-ficcion','romance','animacion'));
     INSERT INTO peliculas_colecciones(pelicula_id,coleccion_id) SELECT film.id,id FROM colecciones WHERE slug=(CASE d.metadata->>'genre' WHEN 'Drama' THEN 'drama' WHEN 'Thriller' THEN 'thriller' WHEN 'Documental' THEN 'documental' WHEN 'Experimental' THEN 'experimental' WHEN 'Comedia' THEN 'comedia' WHEN 'Terror' THEN 'terror' WHEN 'Ciencia ficción' THEN 'ciencia-ficcion' WHEN 'Romance' THEN 'romance' WHEN 'Animación' THEN 'animacion' END);
   END IF;
   INSERT INTO gma_title_media SELECT film.id,asset_id,owner_id,role,slot,language,position FROM gma_draft_media WHERE draft_id=d.id;
   UPDATE peliculas SET r2_poster_url=(SELECT a1.delivery_path FROM gma_title_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id
       WHERE m.title_id=film.id AND m.role IN ('poster_h','poster_v','poster') ORDER BY CASE m.role WHEN 'poster_h' THEN 0 WHEN 'poster_v' THEN 1 ELSE 2 END LIMIT 1),
     r2_subtitle_url=(SELECT a1.delivery_path FROM gma_title_media m JOIN gma_media_assets a1 ON a1.id=m.asset_id WHERE m.title_id=film.id AND m.role='subtitles' ORDER BY m.position LIMIT 1)
     WHERE id=film.id RETURNING * INTO film;
   INSERT INTO gma_upload_publications(draft_id,request_hash,title_id) VALUES(d.id,p_payload->>'request_hash',film.id);
   UPDATE gma_upload_drafts SET state='published',title_id=film.id,revision=revision+1 WHERE id=d.id;
   -- Previous assets are retired only after the new publication is committed atomically.
   FOR s IN SELECT us.* FROM gma_upload_sessions us JOIN gma_upload_drafts dr ON dr.id=us.draft_id
     WHERE dr.title_id=film.id AND dr.id<>d.id AND NOT us.quota_released LOOP
     IF NOT EXISTS(SELECT 1 FROM gma_title_media WHERE asset_id=s.asset_id) THEN
       PERFORM gma_upload_command(p_owner,'cancel',jsonb_build_object('session_id',s.id));
     END IF;
   END LOOP;
   RETURN to_jsonb(film);
 END IF;
 RAISE EXCEPTION 'UPLOAD_INVALID_INPUT';
END; $$;

CREATE OR REPLACE FUNCTION public.gma_upload_event(p_digest text,p_uid text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 INSERT INTO gma_upload_inbox(digest,provider_uid) VALUES(p_digest,p_uid) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT id INTO sid FROM gma_upload_sessions WHERE provider='stream' AND provider_ref=p_uid;
 IF sid IS NOT NULL THEN
   PERFORM gma_upload_enqueue_job('verify',sid,'{}','event:'||p_digest,now());
 END IF;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.gma_upload_schedule() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s gma_upload_sessions; n integer:=0;
BEGIN
 FOR s IN SELECT us.* FROM gma_upload_sessions us WHERE NOT quota_released AND updated_at<now()-interval '1 minute'
   AND NOT EXISTS(SELECT 1 FROM gma_upload_jobs j WHERE j.session_id=us.id AND j.state IN ('pending','running','dead'))
   ORDER BY updated_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
   PERFORM gma_upload_enqueue_job('reconcile',s.id,'{}','reconcile:'||s.id||':'||extract(epoch from now())::text,now());
   UPDATE gma_upload_sessions SET updated_at=now() WHERE id=s.id;
   n:=n+1;
 END LOOP;
 RETURN n;
END; $$;

DO $$
DECLARE t text; f record;
BEGIN
 FOREACH t IN ARRAY ARRAY['gma_upload_policy','gma_upload_drafts','gma_upload_sessions','gma_media_assets','gma_draft_media',
 'gma_title_media','gma_upload_quota','gma_upload_ledger','gma_upload_jobs','gma_upload_inbox','gma_upload_publications','gma_upload_account_deletions'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['gma_upload_drafts','gma_upload_sessions','gma_media_assets','gma_draft_media','gma_title_media'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS owner_read ON public.%I',t);
   EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (owner_id=auth.uid())',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname LIKE 'gma_upload_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END; $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
