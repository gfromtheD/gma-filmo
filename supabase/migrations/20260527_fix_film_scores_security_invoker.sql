-- ============================================================
-- Fix: film_scores view uses SECURITY DEFINER (runs as view
-- creator, bypassing RLS). Recreate it with SECURITY INVOKER
-- so queries execute with the calling role's permissions.
--
-- pg_get_viewdef returns the SELECT body — we wrap it in a
-- CREATE OR REPLACE with the corrected security option.
-- Safe to run multiple times.
-- ============================================================

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_viewdef('public.film_scores', true)
  INTO v_def;

  IF v_def IS NULL THEN
    RAISE NOTICE 'View public.film_scores not found — skipping.';
    RETURN;
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE VIEW public.film_scores WITH (security_invoker = on) AS %s',
    v_def
  );

  RAISE NOTICE 'film_scores recreated with SECURITY INVOKER.';
END $$;
