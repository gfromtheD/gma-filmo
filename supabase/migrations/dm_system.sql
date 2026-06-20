-- ── DM System ────────────────────────────────────────────────────────────────
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS dm_conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_display_name   text,
  other_color          text,
  last_message         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id, viewer_id)
);

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their conversations"  ON dm_conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON dm_conversations;
DROP POLICY IF EXISTS "Participants can update their conversations" ON dm_conversations;

CREATE POLICY "Participants can view their conversations"
  ON dm_conversations FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = viewer_id);

CREATE POLICY "Authenticated users can create conversations"
  ON dm_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id OR auth.uid() = creator_id);

CREATE POLICY "Participants can update their conversations"
  ON dm_conversations FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = viewer_id);

-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id),
  content         text NOT NULL CHECK (char_length(content) <= 2000),
  reply_to_id     uuid REFERENCES dm_messages(id),
  reactions       jsonb NOT NULL DEFAULT '{}',
  is_deleted      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages"          ON dm_messages;
DROP POLICY IF EXISTS "Participants can send messages"          ON dm_messages;
DROP POLICY IF EXISTS "Participants can update messages (reactions)" ON dm_messages;

CREATE POLICY "Participants can view messages"
  ON dm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_conversations c
      WHERE c.id = conversation_id
        AND (c.creator_id = auth.uid() OR c.viewer_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages"
  ON dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM dm_conversations c
      WHERE c.id = conversation_id
        AND (c.creator_id = auth.uid() OR c.viewer_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update messages (reactions)"
  ON dm_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dm_conversations c
      WHERE c.id = conversation_id
        AND (c.creator_id = auth.uid() OR c.viewer_id = auth.uid())
    )
  );

ALTER TABLE dm_messages REPLICA IDENTITY FULL;
