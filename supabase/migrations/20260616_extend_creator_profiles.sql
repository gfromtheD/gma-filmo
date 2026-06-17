-- Adds studio_name (required going forward at signup), location, and website_url.
-- bio already exists and becomes the "studio description" field — capped at 300 chars.
-- NOT VALID + no VALIDATE step: avoids failing the migration if any existing row's
-- bio is already longer than 300 chars; new/updated rows are still checked going forward
-- once validated manually if needed.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS studio_name TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_bio_max_300'
  ) THEN
    ALTER TABLE public.creator_profiles
      ADD CONSTRAINT creator_profiles_bio_max_300
      CHECK (bio IS NULL OR char_length(bio) <= 300) NOT VALID;
  END IF;
END $$;
