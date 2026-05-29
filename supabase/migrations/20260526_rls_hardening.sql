-- ============================================================
-- GMA: RLS hardening — content tables + profiles
-- Safe to run multiple times (IF NOT EXISTS / idempotent)
-- ============================================================

-- ── peliculas: public read-only ───────────────────────────────────────────────
ALTER TABLE IF EXISTS peliculas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'peliculas' AND policyname = 'peliculas_public_read'
  ) THEN
    CREATE POLICY "peliculas_public_read" ON peliculas FOR SELECT USING (true);
  END IF;
END $$;

-- ── artistas: public read-only ────────────────────────────────────────────────
ALTER TABLE IF EXISTS artistas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'artistas' AND policyname = 'artistas_public_read'
  ) THEN
    CREATE POLICY "artistas_public_read" ON artistas FOR SELECT USING (true);
  END IF;
END $$;

-- ── colecciones: public read-only ─────────────────────────────────────────────
ALTER TABLE IF EXISTS colecciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'colecciones' AND policyname = 'colecciones_public_read'
  ) THEN
    CREATE POLICY "colecciones_public_read" ON colecciones FOR SELECT USING (true);
  END IF;
END $$;

-- ── peliculas_colecciones: public read-only ───────────────────────────────────
ALTER TABLE IF EXISTS peliculas_colecciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'peliculas_colecciones' AND policyname = 'peliculas_colecciones_public_read'
  ) THEN
    CREATE POLICY "peliculas_colecciones_public_read" ON peliculas_colecciones FOR SELECT USING (true);
  END IF;
END $$;

-- ── peliculas_artistas: public read-only ──────────────────────────────────────
ALTER TABLE IF EXISTS peliculas_artistas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'peliculas_artistas' AND policyname = 'peliculas_artistas_public_read'
  ) THEN
    CREATE POLICY "peliculas_artistas_public_read" ON peliculas_artistas FOR SELECT USING (true);
  END IF;
END $$;

-- ── film_scores: view — RLS not applicable ───────────────────────────────────
-- film_scores is a VIEW; views inherit security from their underlying tables.
-- No action needed here.

-- ── profiles: own-row access only ────────────────────────────────────────────
-- The service-role admin client (used by community ratings) bypasses RLS.
-- Browser/server anon client can only read and write the authenticated user's own row.
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_own_all'
  ) THEN
    CREATE POLICY "profiles_own_all" ON profiles
      FOR ALL
      USING  (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
