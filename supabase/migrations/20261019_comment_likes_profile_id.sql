-- ── «De acuerdo» por perfil ──────────────────────────────────────────────────
-- Idempotente y aditiva. Misma convención que `comments.profile_id`:
--   profile_id = ''     → perfil principal de la cuenta (así quedan los «De acuerdo» ya existentes)
--   profile_id = 'p_…'  → perfil secundario (`sub_profiles`)
-- La clave primaria pasa a incluir el perfil: dos perfiles de la misma cuenta pueden dar «De acuerdo»
-- al mismo comentario por separado.

ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS profile_id text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'comment_likes'::regclass AND c.contype = 'p' AND a.attname = 'profile_id'
  ) THEN
    ALTER TABLE comment_likes DROP CONSTRAINT comment_likes_pkey;
    ALTER TABLE comment_likes ADD PRIMARY KEY (comment_id, user_id, profile_id);
  END IF;
END $$;
