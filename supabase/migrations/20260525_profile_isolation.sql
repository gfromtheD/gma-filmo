-- ─── Profile isolation: every data table gets a profile_id column ─────────────
--
-- Convention:
--   profile_id = ''           → primary Supabase account profile
--   profile_id = 'p_xxx_yyy'  → Zustand sub-profile ID
--
-- RLS stays unchanged (user_id = auth.uid()). profile_id is just a
-- discriminator within a user's own rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create view_history (was missing from previous migrations) ─────────────
CREATE TABLE IF NOT EXISTS view_history (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      TEXT   NOT NULL DEFAULT '',
  pelicula_id     INT    NOT NULL,
  last_position   FLOAT8  NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'view_history' AND policyname = 'Users own view history'
  ) THEN
    CREATE POLICY "Users own view history"
      ON view_history FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. watchlist ──────────────────────────────────────────────────────────────
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS profile_id TEXT NOT NULL DEFAULT '';

-- Drop old two-column unique constraint (created in 20260524_watchlist_and_ratings.sql)
ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_pelicula_id_key;
-- New three-column unique constraint
ALTER TABLE watchlist
  ADD CONSTRAINT watchlist_profile_pelicula_key UNIQUE (user_id, profile_id, pelicula_id);

-- ── 3. ratings ────────────────────────────────────────────────────────────────
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS profile_id TEXT NOT NULL DEFAULT '';

ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_user_id_pelicula_id_key;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_profile_pelicula_key UNIQUE (user_id, profile_id, pelicula_id);

-- ── 4. view_history profile_id (for tables that already existed) ──────────────
ALTER TABLE view_history ADD COLUMN IF NOT EXISTS profile_id TEXT NOT NULL DEFAULT '';

ALTER TABLE view_history DROP CONSTRAINT IF EXISTS view_history_user_id_pelicula_id_key;
ALTER TABLE view_history
  ADD CONSTRAINT view_history_profile_pelicula_key UNIQUE (user_id, profile_id, pelicula_id);
