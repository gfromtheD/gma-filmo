-- ── Creator avatar ───────────────────────────────────────────────────────────
-- Idempotent: safe to run multiple times

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
