-- Add creator upload columns to peliculas
-- Safe: all columns are nullable, default is NULL / 0

ALTER TABLE peliculas
  ADD COLUMN IF NOT EXISTS creator_user_id  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS genre            TEXT,
  ADD COLUMN IF NOT EXISTS language         TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes  BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status           TEXT    DEFAULT 'published';

-- Index for studio "mis títulos" queries
CREATE INDEX IF NOT EXISTS peliculas_creator_user_id_idx ON peliculas (creator_user_id);
CREATE INDEX IF NOT EXISTS peliculas_status_idx          ON peliculas (status);

-- Update existing scraped content to published so catalog queries still work
UPDATE peliculas SET status = 'published' WHERE status IS NULL;
