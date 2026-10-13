-- ── Comment reports ──────────────────────────────────────────────────────────
-- Idempotent. Escritura solo desde el servidor (service role); sin políticas públicas.

CREATE TABLE IF NOT EXISTS comment_reports (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  comment_id  bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text   CHECK (reason IS NULL OR char_length(reason) <= 300),
  status      text   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS comment_reports_status_idx ON comment_reports (status, created_at DESC);
