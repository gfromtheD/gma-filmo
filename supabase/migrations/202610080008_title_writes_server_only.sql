-- Browser title writes bypass ready checks, published snapshots and durable cleanup.
-- GMA routes use the authenticated server-side RPC/repository path instead.
BEGIN;
REVOKE INSERT,UPDATE,DELETE ON public.peliculas FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
