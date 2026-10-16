-- ── Comentarios: edición, comentario fijado y corazón del creador ────────────
-- Idempotente y aditiva (tres columnas nuevas en `comments`):
--   edited_at         → fecha de la última edición del texto por su autor («editado»).
--   pinned_at         → el creador del título ha fijado este comentario arriba (solo uno por obra).
--   creator_hearted   → el creador del título le ha dado corazón.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at       timestamptz;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS pinned_at       timestamptz;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS creator_hearted boolean NOT NULL DEFAULT false;
