ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS role          TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS vimeo_url     TEXT;
