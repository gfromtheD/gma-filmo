-- ── Comments System ──────────────────────────────────────────────────────────
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS comments (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pelicula_id   int NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT '',
  avatar_color  text,
  parent_id     bigint REFERENCES comments(id) ON DELETE CASCADE,
  content       text NOT NULL CHECK (char_length(content) <= 1000),
  timestamp_ref int,          -- optional: seconds into the video
  like_count    int NOT NULL DEFAULT 0,
  is_deleted    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments"            ON comments;
DROP POLICY IF EXISTS "Authenticated users can comment"    ON comments;
DROP POLICY IF EXISTS "Users can soft-delete own comments" ON comments;

CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Likes ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id  bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id     uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comment likes"  ON comment_likes;
DROP POLICY IF EXISTS "Authenticated users can like"   ON comment_likes;
DROP POLICY IF EXISTS "Users can unlike"               ON comment_likes;

CREATE POLICY "Anyone can view comment likes"
  ON comment_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like"
  ON comment_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Index for fast per-film lookups
CREATE INDEX IF NOT EXISTS comments_pelicula_idx ON comments (pelicula_id, is_deleted, created_at DESC);
