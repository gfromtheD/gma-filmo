-- ── Creator social links (multi-platform) ───────────────────────────────────
-- Idempotent: safe to run multiple times

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
