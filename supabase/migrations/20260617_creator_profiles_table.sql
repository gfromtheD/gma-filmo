-- ─── creator_profiles: auth-linked creator accounts ──────────────────────────
-- This is the source of truth for whether a user has creator access.
-- studio_name being non-null means the creator has completed onboarding.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT,
  studio_name  TEXT,
  bio          TEXT,
  location     TEXT,
  website_url  TEXT,
  role         TEXT,
  instagram_url TEXT,
  vimeo_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own creator profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'creator_profiles' AND policyname = 'creator_profiles_own'
  ) THEN
    CREATE POLICY "creator_profiles_own"
      ON public.creator_profiles FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Public read (so profile pages can display creator info without auth)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'creator_profiles' AND policyname = 'creator_profiles_public_read'
  ) THEN
    CREATE POLICY "creator_profiles_public_read"
      ON public.creator_profiles FOR SELECT
      USING (true);
  END IF;
END $$;

-- Ensure all columns from later ALTER TABLE migrations exist
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS studio_name   TEXT,
  ADD COLUMN IF NOT EXISTS location      TEXT,
  ADD COLUMN IF NOT EXISTS website_url   TEXT,
  ADD COLUMN IF NOT EXISTS role          TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS vimeo_url     TEXT;
